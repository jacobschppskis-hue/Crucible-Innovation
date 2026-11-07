// The liquid's look (GLSL ES 3.00, WebGL2): a glossy black liquid at night. One full-screen pass over the wave grid
// (sim.ts), uploaded as a float texture every frame and reconstructed with a cubic B-spline (16 texel fetches, smooth to
// the second derivative, so normals never show the grid), plus the analytic idle swell (swell.ts).
//
// The surface is SHADED, not outlined:
// - environment: it reflects a very dark sky, near black below and dark warm grey towards the top of the screen, so
//   every slope shows as a tonal band. At rest the swell moves only this faint, broad sheen (never a line, never Ember).
//   Waves only ever ADD light to the surface around them: a steep face that would reflect the black part of the sky
//   keeps the swell's own sheen, so a wake, a trough or the steep water right at the pointer never reads as a hole.
// - key: a warm light low on the bottom edge (Blinn-Phong). Interaction waves (the grid: cursor, taps, fingers, scroll)
//   catch it: a soft lobe gives their lit faces a warm body and the far faces a light shadow, and the sharp core gives
//   crisp Ember glints. The light is a strip along that edge (wide across the screen, narrow up it), so every crest
//   flank that faces it catches a streak along the crest, not one fleck; glints only show where the surface curves
//   (a crest), never as a wide puddle where a gentle slope happens to face the light. The swell is too gentle to reach
//   it, so Ember lives only where something just happened.
// - caustic: a faint warm brightening where the surface focuses light (-laplacian of the height): the refraction cue.
// - behind text and portraits (the mask texture) the key is capped, so text keeps AA contrast.

import { swellGLSL } from './swell';

export const VERT = /* glsl */ `#version 300 es
in vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }`;

/** Look constants (tuned on recorded frames at 1440 and 390, Chromium and WebKit; the look lab overrides them). */
export const LOOK = {
  relief: 3.4, // interaction waves: slope -> normal tilt (shading exaggeration)
  reliefSwell: 2.0, // the idle swell, for the environment only (a faint broad sheen)
  key: [-0.2, 0.5, 0.84], // direction to the warm key light (x right, y down the screen, z out of it)
  soft: 48, // Blinn-Phong exponent of the soft lobe (the warm body of lit faces)
  softK: 0.2, // its strength (x Ember)
  core: 0.999, // n.h above which the sharp core glints (about 2.6 degrees up the screen; coreX times that across)
  coreK: 1.0,
  coreX: 4, // the key's width across the screen relative to its height (1 = a round lamp, more = a strip of light)
  crisp: [0.002, 0.005] as number[], // curvature (|laplacian|, 1/px) over which a glint fades in: off when [0, 0]
  shade: 0.15, // faces tilted away from the key (towards the top of the screen) fall into a light shadow (0..1)
  dip: -0.01, // how much darker than the swell's own sheen a wave may reflect (sky units): never a hole
  env: [0.15, 0.14, 0.13], // the sky's brightest (dark warm grey), towards the top of the screen
  envW: 0.38, // its spread (tilt)
  caustic: 0.025,
  textCap: 0.17, // the key behind body text: at most this (bone-dim text keeps 4.65:1 even at the centre of a glint
  // on the swell's brightest sheen, worked out from this formula)
};

const f = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));
const v3 = (a: number[]) => `vec3(${a.map(f).join(', ')})`;

export function fragment() {
  const k = LOOK.key;
  const kl = Math.hypot(k[0], k[1], k[2]);
  const key = [k[0] / kl, k[1] / kl, k[2] / kl];
  const hl = Math.hypot(key[0], key[1], key[2] + 1);
  const half = [key[0] / hl, key[1] / hl, (key[2] + 1) / hl];
  return /* glsl */ `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
uniform sampler2D uH;   // heights (px), R32F, cols x rows; cell (i, j) centre at uOrg + (i, j) * uCell (viewport css px)
uniform sampler2D uM;   // text mask, R8
uniform vec2 uView;     // viewport, css px
uniform float uScale;   // canvas px per css px
uniform vec2 uOrg;
uniform float uCell;
uniform ivec2 uSize;
uniform float uOn;      // the grid has waves
uniform float uSeed;
out vec4 o;
${swellGLSL()}

const vec3 GROUND = vec3(0.0510, 0.0510, 0.0431);
const vec3 EMBER = vec3(1.0, 0.357, 0.122);
const vec3 KEY = ${v3(key)};
const vec3 HK = ${v3(half)};

void bs(float t, out vec4 w, out vec4 d, out vec4 e) {
  float s = 1.0 - t;
  float t2 = t * t;
  float t3 = t2 * t;
  w = vec4(s * s * s, 3.0 * t3 - 6.0 * t2 + 4.0, -3.0 * t3 + 3.0 * t2 + 3.0 * t + 1.0, t3) / 6.0;
  d = vec4(-0.5 * s * s, 1.5 * t2 - 2.0 * t, -1.5 * t2 + t + 0.5, 0.5 * t2);
  e = vec4(s, 3.0 * t - 2.0, 1.0 - 3.0 * t, t);
}
float tap(ivec2 c) { return texelFetch(uH, clamp(c, ivec2(0), uSize - 1), 0).r; }
float mtap(ivec2 c) { return texelFetch(uM, clamp(c, ivec2(0), uSize - 1), 0).r; }
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
// the dark sky the surface reflects: brightest towards the top of the screen; r = reflected direction's tilt (xy)
float sky(vec2 r) { vec2 d = r - vec2(0.0, -0.55); return exp(-dot(d, d) / ${f(LOOK.envW * LOOK.envW)}); }

void main() {
  vec2 css = vec2(gl_FragCoord.x, uView.y * uScale - gl_FragCoord.y) / uScale;
  vec3 sw = swell(css);
  vec2 gr = vec2(0.0);
  float lap = 0.0;
  float mk = 0.0;
  if (uOn > 0.5) {
    vec2 g = (css - uOrg) / uCell;
    vec2 fl = floor(g);
    vec2 fr = g - fl;
    ivec2 b = ivec2(fl) - 1;
    vec4 wx, dx, ex, wy, dy, ey;
    bs(fr.x, wx, dx, ex);
    bs(fr.y, wy, dy, ey);
    for (int j = 0; j < 4; j++) {
      vec4 r = vec4(tap(b + ivec2(0, j)), tap(b + ivec2(1, j)), tap(b + ivec2(2, j)), tap(b + ivec2(3, j)));
      float sh = dot(wx, r);
      gr.x += wy[j] * dot(dx, r);
      gr.y += dy[j] * sh;
      lap += wy[j] * dot(ex, r) + ey[j] * sh;
    }
    gr /= uCell;
    lap /= uCell * uCell;
    ivec2 c = ivec2(fl);
    mk = mix(mix(mtap(c), mtap(c + ivec2(1, 0)), fr.x), mix(mtap(c + ivec2(0, 1)), mtap(c + ivec2(1, 1)), fr.x), fr.y);
  }
  float cap = mix(1.0, ${f(LOOK.textCap)}, clamp(mk, 0.0, 1.0));

  // environment: the whole surface (interaction waves + swell) reflects the dark sky; flat = exactly the ground
  vec2 ta = gr * ${f(LOOK.relief)} + sw.yz * ${f(LOOK.reliefSwell)};
  // Interaction waves only ever add sky to what the swell shows: a steep face that would reflect the black part of the
  // sky keeps the swell's own sheen (a hair darker at most), so a wake or a trough never reads as a hole.
  float s0 = sky(vec2(0.0));
  float es = sky(-2.0 * sw.yz * ${f(LOOK.reliefSwell)}) - s0;
  float env = es + max(sky(-2.0 * ta) - s0 - es, ${f(LOOK.dip)});
  vec3 col = GROUND + (${v3(LOOK.env)} - GROUND) * env * mix(1.0, 0.6, clamp(mk, 0.0, 1.0));

  // key: interaction waves only (the swell never reaches it)
  vec3 n = normalize(vec3(-gr * ${f(LOOK.relief)}, 1.0));
  float nh = max(dot(n, HK), 0.0);
  float soft = max(pow(nh, ${f(LOOK.soft)}) - pow(HK.z, ${f(LOOK.soft)}), 0.0);
  // the key's reflection: where the surface's tilt is within the lamp's shape around the mirror tilt (an ellipse in
  // tilt space, ${f(LOOK.coreX)} x wider across the screen than up it)
  vec2 dd = (-gr * ${f(LOOK.relief)} - HK.xy / HK.z) / vec2(${f(Math.tan(Math.acos(LOOK.core)) * LOOK.coreX)}, ${f(Math.tan(Math.acos(LOOK.core)))});
  float m = dot(dd, dd);
  float am = max(fwidth(m), 1e-4);
  float core = (1.0 - smoothstep(1.0 - am, 1.0 + am, m)) * (0.6 + 0.4 * (1.0 - smoothstep(0.0, 1.0, m)));
  ${LOOK.crisp[1] > 0 ? `core *= smoothstep(${f(LOOK.crisp[0])}, ${f(LOOK.crisp[1])}, abs(lap));` : ''}
  // faces turned away from the key (towards the top of the screen) fall into a light shadow; a face that only leans
  // sideways or is steep does not (v2r2 darkened every steep face by up to 55%: a black core at the pointer)
  float away = clamp(dot(gr * ${f(LOOK.relief)}, KEY.xy) * 3.0, 0.0, 1.0);
  col *= 1.0 - ${f(LOOK.shade)} * away;
  // caustic: faint warm light where the surface focuses it
  float ca = ${f(LOOK.caustic)} * smoothstep(0.0, 0.01, -lap) * smoothstep(0.01, 0.06, length(gr));
  col += EMBER * (${f(LOOK.softK)} * soft + ${f(LOOK.coreK)} * core + ca) * cap;

  col += (hash(gl_FragCoord.xy + uSeed) - 0.5) / 255.0; // dither: no banding in the dark
  o = vec4(col, 1.0);
}`;
}
