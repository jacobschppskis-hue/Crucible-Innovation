// The liquid's fragment shader (GLSL ES 1.0, valid in WebGL1 and WebGL2) and its wave formula, shared by the worker
// renderer, the main-thread fallback and the Thesis flames (lib/gl/molten.ts, which embeds `wavesGLSL` / `swellGLSL`, so
// there is one formula and one crest look). The formula is the one in field.ts (`sample`, `cone`, `strength`), in GLSL.
//
// Crests are LINES: each event (a tap, a stroke) makes its own thin line, and lines combine as max(), never as summed
// heights, so they cross cleanly. A tap is two concentric rings. A stroke is the boundary of the union of disks that
// grow at wave speed from every point the pointer passed (cone segments between samples): a V behind a fast pointer, a
// teardrop as it slows, no lens where it stops. Heights are only used for refraction (the slope bends what is under).

import { CALM_MAX, DECAY, DISP, SEGSIG, SPEED, SPREAD, SWELL, TAPGAP, TRAIL } from './field';

const f = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));

/** Uniforms uN, uA[cap], uB[cap] and `void waves(vec2 p, float pxs, out float line, out vec2 gp, out vec2 gf)`:
 *  line = crest coverage 0..1 (Ember line, ~1.5 px wide; pxs = CSS px per device px), gp = slope of taps and wakes,
 *  gf = slope of the floating things' ripples. Entries: see packSources in field.ts. */
export function wavesGLSL(cap: number) {
  return /* glsl */ `
uniform int uN;
uniform vec4 uA[${cap}];
uniform vec4 uB[${cap}];

float coneD(vec2 p, vec2 a, vec2 b, float r1, float r2, out vec2 gr, out float s) {
  vec2 ba = b - a;
  float h = length(ba);
  vec2 q = p - a;
  if (h < 0.5 || abs(r1 - r2) >= 0.999 * h) {
    if (r1 >= r2) { float l = max(length(q), 0.001); gr = q / l; s = 0.0; return l - r1; }
    vec2 q2 = p - b; float l2 = max(length(q2), 0.001); gr = q2 / l2; s = 1.0; return l2 - r2;
  }
  vec2 u = ba / h;
  vec2 n = vec2(-u.y, u.x);
  float y = dot(q, u);
  float x = dot(q, n);
  float sx = x < 0.0 ? -1.0 : 1.0;
  float ax = abs(x);
  float bb = (r1 - r2) / h;
  float aa = sqrt(1.0 - bb * bb);
  float k = -bb * ax + aa * y;
  if (k < 0.0) { float l = max(length(vec2(ax, y)), 0.001); gr = (n * x + u * y) / l; s = 0.0; return l - r1; }
  if (k > aa * h) { float l = max(length(vec2(ax, y - h)), 0.001); gr = (n * x + u * (y - h)) / l; s = 1.0; return l - r2; }
  gr = n * (aa * sx) + u * bb;
  s = clamp(y / h, 0.0, 1.0);
  return aa * ax + bb * y - r1;
}
float strength(float age, float amp) {
  float f = clamp((age - 1.8) / 1.0, 0.0, 1.0);
  return min(1.0, amp * 1.3 * exp(-0.4 * age)) * (1.0 - f * f * (3.0 - 2.0 * f));
}
float cover(float d, float pxs) { return 1.0 - smoothstep(0.75 - 0.5 * pxs, 0.75 + 0.5 * pxs, abs(d)); }
float hump(float d, float sig, float age, float amp, out float e) {
  float R = ${f(SPEED)} * age;
  float A = amp * exp(-${f(DECAY)} * age) / sqrt((1.0 + R / ${f(SPREAD)}) * (1.0 + ${f(DISP)} * age));
  e = exp(-0.5 * d * d / (sig * sig));
  return A * e;
}
// one stroke's front: its line (and a fainter trailing one) and the slope of its hump
void front(float d, vec2 gr, float age, float amp, float pxs, inout float line, inout vec2 gp) {
  float sig = ${f(SEGSIG)} * (1.0 + ${f(DISP)} * age);
  if (abs(d) < 3.0 * sig) {
    float e;
    float Ah = hump(d, sig, age, amp, e);
    gp += gr * (Ah * (-d / (sig * sig)));
  }
  float I = strength(age, amp);
  line = max(line, I * max(cover(d, pxs), 0.4 * cover(d + ${f(TRAIL)}, pxs)));
}
void waves(vec2 p, float pxs, out float line, out vec2 gp, out vec2 gf) {
  line = 0.0;
  gp = vec2(0.0);
  gf = vec2(0.0);
  float dS = 1e3;
  vec2 gS = vec2(0.0);
  float aS = 0.0;
  float mS = 0.0;
  for (int i = 0; i < ${cap}; i++) {
    if (i >= uN) break;
    vec4 a = uA[i];
    vec4 b = uB[i];
    if (b.w > 1.5) {
      if (b.w > 2.5) {
        if (dS < 100.0) front(dS, gS, aS, mS, pxs, line, gp);
        dS = 1e3;
      }
      float r1 = ${f(SPEED)} * a.z;
      float r2 = ${f(SPEED)} * b.z;
      float bound = length(p - 0.5 * (a.xy + b.xy)) - (0.5 * length(b.xy - a.xy) + max(r1, r2));
      if (bound > ${f(3 * SEGSIG)} * (1.0 + ${f(DISP)} * max(a.z, b.z))) continue;
      vec2 gr;
      float s;
      float d = coneD(p, a.xy, b.xy, r1, r2, gr, s);
      if (d < dS) { dS = d; gS = gr; aS = mix(a.z, b.z, s); mS = a.w; }
      continue;
    }
    float age = a.z;
    vec2 dv = p - a.xy;
    float r = length(dv);
    float sig = b.x * (1.0 + ${f(DISP)} * age);
    float R = ${f(SPEED)} * age;
    float d = r - R;
    if (abs(d) < 3.0 * sig) {
      float e;
      float Ah = hump(d, sig, age, a.w, e);
      vec2 gi = dv / max(r, 0.001) * (Ah * (-d / (sig * sig)));
      if (b.w > 0.5) gf += gi; else gp += gi;
    }
    if (b.w < 0.5) {
      float I = strength(age, a.w);
      float l = cover(d, pxs);
      if (R > ${f(TAPGAP)}) l = max(l, 0.5 * cover(d + ${f(TAPGAP)}, pxs));
      line = max(line, I * l);
    }
  }
  if (dS < 100.0) front(dS, gS, aS, mS, pxs, line, gp);
}`;
}

/** `void swell(vec2 p, float time, float pxs, out vec2 gs, out float line)`: the idle swell's slope, and a faint straight
 *  crest line along its main wave (parallel lines: it never closes into loops near a tap). */
export function swellGLSL() {
  const body = SWELL.map(([ang, len, spd, a, ph]) => {
    const kx = (Math.cos(ang) * 2 * Math.PI) / len;
    const ky = (Math.sin(ang) * 2 * Math.PI) / len;
    const w = ((2 * Math.PI) / len) * spd;
    return `{ float ar = ${kx}*p.x + ${ky}*p.y - ${w}*time + ${ph}; g += ${a}*cos(ar)*vec2(${kx}, ${ky}); }`;
  }).join('\n  ');
  const [ang0, len0, spd0, , ph0] = SWELL[0];
  const kx0 = (Math.cos(ang0) * 2 * Math.PI) / len0;
  const ky0 = (Math.sin(ang0) * 2 * Math.PI) / len0;
  return /* glsl */ `
void swell(vec2 p, float time, float pxs, out vec2 gs, out float line) {
  vec2 g = vec2(0.0);
  ${body}
  gs = g;
  float cyc = (${kx0}*p.x + ${ky0}*p.y - ${((2 * Math.PI) / len0) * spd0}*time + ${ph0}) / 6.2831853;
  float dl = abs(fract(cyc + 0.25) - 0.5) * ${f(len0)}; // px to the nearest crest of the main wave
  line = 0.16 * cover(dl, pxs);
}`;
}

export function fragment(cap: number) {
  return /* glsl */ `
precision highp float;
uniform vec2 uView;
uniform float uScale;
uniform float uScroll;
uniform float uTime;
uniform vec4 uCalm[${CALM_MAX}];
${wavesGLSL(cap)}
${swellGLSL()}

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

void main() {
  vec2 p = vec2(gl_FragCoord.x, uView.y * uScale - gl_FragCoord.y) / uScale;
  p.y += uScroll;
  float px = 1.0 / uScale;
  float line;
  vec2 gp, gf, gs;
  float sl;
  waves(p, px, line, gp, gf);
  swell(p, uTime, px, gs, sl);

  // Body: even near-black. A very faint, fine, regular dot lattice seen through the surface (the slope bends where we
  // look), so refraction is visible without any blotchy texture.
  vec2 q = (p + (gp + gf + gs) * 70.0) / 16.0;
  vec2 f = fract(q) - 0.5;
  float dotv = 1.0 - smoothstep(0.07, 0.07 + 1.1 / (16.0 * uScale), length(f));
  vec3 col = vec3(0.047, 0.047, 0.043) + vec3(0.9, 0.78, 0.62) * 0.03 * dotv;

  // Calm zones (the ASCII portraits): no crest lines over a face, a soft edge around the box.
  float fade = 1.0;
  for (int k = 0; k < ${CALM_MAX}; k++) {
    vec4 c = uCalm[k];
    if (c.z <= 0.0) continue;
    vec2 qd = abs(p - c.xy - 0.5 * c.zw) - 0.5 * c.zw;
    float dd = length(max(qd, 0.0)) + min(max(qd.x, qd.y), 0.0);
    fade *= smoothstep(-4.0, 36.0, dd);
  }
  col += vec3(1.0, 0.357, 0.122) * max(line * 0.95, sl) * fade;

  col += (hash(gl_FragCoord.xy + uTime) - 0.5) / 255.0; // dither: no banding in the dark
  gl_FragColor = vec4(col, 1.0);
}`;
}

export const VERT = `attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }`;
