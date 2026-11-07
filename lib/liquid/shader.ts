// The liquid's fragment shader (GLSL ES 1.0, valid in WebGL1 and WebGL2) and its wave formula, shared by the worker
// renderer, the main-thread fallback and the Thesis flames (lib/gl/molten.ts, which embeds `wavesGLSL` / `swellGLSL`, so
// there is one formula and one crest look). The formula is the one in field.ts (`sample`, `hullD`, `strength`), in GLSL.
//
// Crests are LINES: each event (a tap, a stroke) makes its own thin line, and lines combine as max(), never as summed
// heights, so they cross cleanly. A tap is two concentric rings. A stroke is the boundary of the convex hull of the
// disks that grow at wave speed from every point the pointer passed: a V behind a fast pointer, a teardrop as it slows, never
// a notch where the path bends (the union of the disks would have creases and cusps there). Heights are only used for refraction (the slope bends what is under).

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

// One disk of a wake's convex hull and the bridge leaving it for the next disk (see hullD in field.ts): the signed distance to
// the hull is the largest of the bridge's line and, when the point faces the disk's arc, the disk's own distance.
void hullPiece(vec2 p, vec4 A, vec2 na, vec4 Q, vec2 nb, inout float dS, inout vec2 gS, inout float aS, inout float mS) {
  vec2 v = p - A.xy;
  float l = max(length(v), 0.001);
  float r = ${f(SPEED)} * A.z;
  bool single = dot(na, na) < 0.5;
  bool inr = true;
  if (!single) {
    inr = (na.x * nb.y - na.y * nb.x >= 0.0)
      ? (na.x * v.y - na.y * v.x >= 0.0 && v.x * nb.y - v.y * nb.x >= 0.0)
      : !(nb.x * v.y - nb.y * v.x > 0.0 && v.x * na.y - v.y * na.x > 0.0);
  }
  if (inr && l - r > dS) { dS = l - r; gS = v / l; aS = A.z; mS = A.w; }
  if (!single) {
    float dl = dot(v, nb) - r;
    if (dl > dS) {
      dS = dl;
      gS = nb;
      vec2 tg = vec2(-nb.y, nb.x);
      vec2 Tp = A.xy + r * nb;
      float len = dot(Q.xy + ${f(SPEED)} * Q.z * nb - Tp, tg);
      float s = len > 0.001 ? clamp(dot(p - Tp, tg) / len, 0.0, 1.0) : 0.0;
      aS = mix(A.z, Q.z, s);
      mS = mix(A.w, Q.w, s);
    }
  }
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
  float dS = -1e3;
  vec2 gS = vec2(0.0);
  float aS = 0.0;
  float mS = 0.0;
  vec4 pA = vec4(0.0);
  vec2 pN = vec2(0.0);
  vec4 fA = vec4(0.0);
  vec2 fN = vec2(0.0);
  int cnt = 0;
  for (int i = 0; i < ${cap}; i++) {
    if (i >= uN) break;
    vec4 a = uA[i];
    vec4 b = uB[i];
    if (b.w > 1.5) {
      if (b.w > 2.5) {
        if (cnt > 0) {
          hullPiece(p, pA, pN, fA, fN, dS, gS, aS, mS);
          if (dS < 100.0) front(dS, gS, aS, mS, pxs, line, gp);
        }
        dS = -1e3;
        cnt = 0;
      }
      if (cnt == 0) { fA = a; fN = b.xy; } else hullPiece(p, pA, pN, a, b.xy, dS, gS, aS, mS);
      pA = a;
      pN = b.xy;
      cnt++;
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
  if (cnt > 0) {
    hullPiece(p, pA, pN, fA, fN, dS, gS, aS, mS);
    if (dS < 100.0) front(dS, gS, aS, mS, pxs, line, gp);
  }
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
