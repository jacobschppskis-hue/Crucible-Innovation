// Rich tier for the home Thesis: a fire that comes up with the reading (293 K → 1811 K).
//
// How it is drawn (the P5c lab, .board/v2/p5c/LAB.md): every point of the fire is gas that left the burning bed at one
// place and one moment and has risen since at exactly RISE, so its age is its height / RISE, and everything in the
// flames (necks, ripples, a top that lets go) climbs at that one pace whatever the heat. The outline is where that gas
// has burnt out: gas burns until its age reaches its fuel * LIFE. The bases along the floor release their fuel in puffs
// that start quickly and thin out fast, so inside a puff the later, leaner gas burns out first: the puff necks, lets go,
// and its top keeps climbing at RISE while it burns away from below. (With smooth, even bursts the oldest gas at the top
// would die first, the tops would be eaten from above and the tongues would pulse in place.)
// Heat never touches time: it sets how long the gas burns (how tall the tongues reach), how much of the floor burns and
// how bright and hot the light is. Nothing glows below ~800 K and the fire stays small and sparse to ~1200 K; at 1811 K
// tall tongues stand in clusters, the tallest near a fifth of the screen, with licks and dark gaps over one warm bed.
// Colour is temperature: amber cores low in the thick tongues, orange bodies, deep red thin tips and let-go pieces.
// Every edge is crisp at screen resolution (a threshold antialiased over about a pixel); the canvas is transparent around
// and between the tongues, so the liquid shows through. Heat is followed with a rate-limited ease, so a scroll jump still
// brings the fire up gradually.
// Drawn on the one clock (`onFrame`) only while on screen; it steps its resolution down on slow frames (never while a
// harness drives the clock).
import { clock, clockHeld, onFrame, renderer } from '@/lib/liquid/loop';
import { swellGLSL, swellPhases } from '@/lib/liquid/swell';

type Options = { canvas: HTMLCanvasElement; heat: () => number; onReady?: () => void; onFail?: () => void };

const VERT = `attribute vec2 aPos; void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

// The liquid's idle swell (lib/liquid/swell.ts, same sum as the page's liquid), relative to the canvas' top-left: the
// flames are seen through the surface, so they bend a little with its slope. (The liquid's own glints show around the
// flames, on the liquid canvas below; this canvas draws no wave lines of its own.)
const WAVES = `
uniform vec2 uCss; // canvas size in CSS px
${swellGLSL()}
vec2 canvasPos(vec2 uv) { return vec2(uv.x, 1.0 - uv.y) * uCss; }
`;

// Upward flow in viewport heights per second. One constant for every heat: the gas climbs at the same pace at 800 K
// and at 1811 K.
const RISE = 0.17;

// The canvas covers this share of the scene's height, from the floor up (globals.css `.thesis-gl`); at 1811 K the
// tallest clusters reach about 0.2, and nothing can pass 0.29.
export const FLAME_SPAN = 0.3;

// Units: P = canvas px / uVh, so heights are fractions of the scene (viewport) height and x is in the same unit.
// Noise: simplex 2D/3D by Ian McEwan, Ashima Arts (MIT); hash by Dave Hoskins, "Hash without Sine" (MIT).
const FRAG = `
precision highp float;
${WAVES}
uniform vec2 uRes; // canvas size in device px
uniform float uVh; // the scene's height in canvas px
uniform float uTime, uK; // flow time (s), heat 0..1
uniform vec3 uMouse; // canvas px from bottom-left, strength
const float RISE = ${RISE.toFixed(3)};

float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = i - floor(i * (1.0 / 289.0)) * 289.0;
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  vec3 ns = 0.142857142857 * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = 1.79284291400159 - 0.85373472095314 * vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
// Blackbody colour on the site's stops: dark, deep red, Ember (#ff5b1f), ember-hot (#ffb347), white heat.
vec3 heatRamp(float t) {
  vec3 c = mix(vec3(0.05, 0.012, 0.0), vec3(0.42, 0.045, 0.0), smoothstep(0.0, 0.32, t));
  c = mix(c, vec3(1.0, 0.357, 0.122), smoothstep(0.28, 0.62, t));
  c = mix(c, vec3(1.0, 0.702, 0.278), smoothstep(0.6, 0.86, t));
  return mix(c, vec3(1.0, 0.95, 0.86), smoothstep(0.88, 1.0, t));
}
// How much of the floor burns: a patch in the middle at first glow, the whole width when hot; its ends wander.
float bedMask(float x, float wv, float e, float t) {
  float cx = abs(x / wv - 0.5) * 2.0;
  float hw = mix(0.16, 1.32, pow(e, 0.8));
  return 1.0 - smoothstep(hw - 0.3, hw, cx + 0.2 * snoise(vec2(x * 1.3 + 7.0, t * 0.05)));
}
// Two strong bases merged into one tongue still stay inside the band: fuel is capped softly at 1.1 (1.1 tanh(f / 1.1)),
// which leaves one base's fuel nearly as it is.
float softcap(float f) {
  float q = exp(-1.8182 * f);
  return 1.1 * (1.0 - q) / (1.0 + q);
}
// A value that wanders smoothly over time (0..1), one per cell.
float wob(float c, float te, float seed) {
  float i = floor(te), f = fract(te);
  return mix(hash12(vec2(c + seed, i)), hash12(vec2(c + seed, i + 1.0)), f * f * (3.0 - 2.0 * f));
}
// Where the fire gathers: one cluster in every 0.6-vh stretch of floor, wandering inside it, 0.24-0.38 vh wide, its
// strength drifting; between them only low licks over the bed. (Explicit, so every screen has clusters and gaps: a
// smooth noise is often nearly flat across one screen and then the bed burns evenly.)
float clusters(float x, float te) {
  const float CW = 0.6;
  float ci = floor(x / CW), m = 0.0;
  for (int j = -1; j <= 1; j++) {
    float c = ci + float(j);
    float xc = (c + 0.25 + 0.5 * wob(c, te * 0.06, 1.0)) * CW;
    float hw = CW * (0.2 + 0.12 * wob(c, te * 0.08, 7.0));
    float amp = 0.7 + 0.3 * wob(c, te * 0.1, 3.0);
    m = max(m, amp * (1.0 - smoothstep(0.35, 1.0, abs(x - xc) / hw)));
  }
  return m;
}
// A base's puffs at emission time te: x = fuel 0..1 (a quick start, then a tail that thins out and ends at exactly 0,
// each puff its own strength), y = how far through its puff. Every base keeps its own pace, about 1-1.6 puffs a second.
vec2 puff(float c, float te, float seed, float rate) {
  float nu = rate * (0.8 + 0.45 * hash12(vec2(c, seed + 3.1)));
  float ph = te * nu + hash12(vec2(c, seed + 7.7)) + 0.25 * snoise(vec2(c * 0.61 + seed, te * 0.35));
  float n = floor(ph), u = fract(ph);
  float A = 0.3 + 0.7 * hash12(vec2(c * 1.13 + seed, n));
  return vec2(A * smoothstep(0.0, 0.18, u) * (exp(-2.8 * u) - 0.0608) * 1.8, u);
}
// One family of tongue bases, one per slot, each wandering along the floor. Across a base the fuel is a candle profile
// (steep sides, a pointed top) that widens over its puff (a narrow jet first); neighbours add, so two bases that drift
// together merge into one taller tongue, and part again. s = how strongly this stretch of floor burns.
float bases(float x0, float te, float slot, float seed, float amp, float s, float rate) {
  float ci = floor(x0 / slot);
  float f = 0.0;
  for (int j = -1; j <= 1; j++) {
    float c = ci + float(j);
    float xi = (c + 0.5 + 0.48 * snoise(vec2(c * 0.73 + seed, te * 0.25))) * slot;
    vec2 pf = puff(c, te, seed, rate);
    float q = s * (0.18 + 0.82 * pf.x);
    float w = slot * 0.6 * (0.5 + 0.4 * q) * (0.45 + 0.55 * smoothstep(0.0, 0.35, pf.y) * (1.0 - smoothstep(0.7, 1.0, pf.y)));
    f += amp * q * pow(max(0.0, 1.0 - abs(x0 - xi) / w), 0.75);
  }
  return f;
}
void main() {
  // Nothing glows below ~800 K (k 0.33, the Draper point); all of the fire at 1811 K.
  float e = clamp((uK - 0.32) / 0.68, 0.0, 1.0);
  if (e <= 0.0) { gl_FragColor = vec4(0.0); return; }
  vec2 uv0 = gl_FragCoord.xy / uRes;
  // refraction: seen through the liquid, the flames shift a few px along the swell's slope
  vec3 sw = swell(canvasPos(uv0));
  vec2 P = (gl_FragCoord.xy + sw.yz * vec2(1.0, -1.0) * 90.0 * uRes / uCss) / uVh;
  // A narrow screen sees a narrower slice of the same bed, with slimmer tongues, so a phone still shows several.
  float xs = clamp(uRes.x / uVh / 1.2, 0.65, 1.0);
  float x = P.x / xs, y = P.y, wv = uRes.x / uVh / xs;
  float LIFE = 0.42 + 1.08 * e * sqrt(e); // how long the richest gas burns (s): how tall the tongues reach (small and
  // gentle up to ~1200 K, the tallest clusters near a fifth of the screen at 1811 K)
  float a = y / RISE; // the age of the gas here
  if (a > LIFE + 0.25) { gl_FragColor = vec4(0.0); return; }
  float t = uTime;
  float te = t - a; // when it left the bed
  float fy = y - RISE * t; // the gas's own frame: whatever is drawn in it climbs at RISE
  // Where it left the bed: undo a sway carried up with the gas (the upper parts of tall tongues whip a little) and the
  // sideways drift it was born with (a bend that travels up the tongue).
  float sway = a * a * 0.04 * snoise(vec3(x * 9.0, fy * 7.0, t * 0.3));
  float x0 = x - sway;
  for (int i = 0; i < 2; i++) x0 = x - sway - a * 0.03 * snoise(vec2(x0 * 3.1 + 11.0, te * 0.5));
  // The strong bases stand in clusters (tall tongues), low licks and dark gaps between; while the bed is still narrow,
  // its first flames stand in its middle.
  float bm = bedMask(x0, wv, e, te);
  float cl = max(clusters(x0, te), (1.0 - e) * (1.0 - smoothstep(0.0, 0.5, abs(x0 / wv - 0.5) * 2.0)));
  float f1 = mix(0.08, 0.18, e), f2 = mix(0.3, 0.5, e); // the bed between clusters fills in a little as it heats
  float s1 = bm * (f1 + (1.0 - f1) * cl), s2 = bm * (f2 + (1.0 - f2) * cl);
  // The most fuel any gas here could carry (two bases of each family on one spot, at a full puff): where even that has
  // burnt out, skip the bases.
  float fuel = 0.0;
  if (a / LIFE < softcap(2.0 * (s1 + 0.6 * s2)) + 0.12) {
    // two families of bases with incommensurate slots: tall tongues, and licks
    fuel = softcap(bases(x0, te, 0.047, 0.0, 1.0, s1, 1.25) + bases(x0, te, 0.029, 17.0, 0.6, s2, 1.9));
  }
  // edge ripples carried up with the gas, none at the floor
  float rip = 0.04 * snoise(vec3(x * 20.0, fy * 13.0, t * 0.4));
  float phi = fuel - a / LIFE + rip * smoothstep(0.0, 0.25, a / LIFE);
  float w = clamp(fwidth(phi), 1e-5, 0.03);
  float cov = smoothstep(-0.7 * w, 0.7 * w, phi);
  // Light is temperature. The gas is hottest where it is fresh and deep inside a thick tongue: low in the strong tongues
  // the core is amber (ember-hot, a touch of white at 1811 K); the body is orange; thin tips, the rim and let-go pieces
  // are deep red and darker as they burn out, and let the liquid through. At lower heat every part is redder.
  float burnt = clamp(a / max(fuel * LIFE, 0.04), 0.0, 1.0); // how far through its burn this gas is
  float fresh = 1.0 - burnt;
  float rim = smoothstep(0.0, 0.08, phi); // just inside the edge
  float depth = smoothstep(0.06, 0.6, phi); // deep inside a thick tongue
  float temp = 0.3 + mix(0.6, 1.0, e) * (rim * (0.14 + 0.2 * fresh) + (0.08 + 0.2 * e) * depth * fresh);
  float op = cov * mix(0.75, 1.0, rim) * mix(1.0, 0.45, burnt * burnt) * mix(0.6, 1.0, e);
  vec4 f = vec4(heatRamp(temp) * op, op);
  // The bed: one low glowing band, its top uneven and slowly changing, brightest under the bases burning hardest.
  if (y < 0.022) {
    float top = mix(0.006, 0.011, e) * (1.0 + 0.45 * snoise(vec2(x * 21.0, t * 0.25)) + 0.25 * snoise(vec2(x * 63.0 + 3.0, t * 0.5)));
    float hot = 0.5 + 0.5 * snoise(vec2(x * 7.0 - t * 0.03, t * 0.12));
    float bw = 0.75 / uVh; // the band's edge is horizontal-ish: antialias it over about a pixel without derivatives
    float bc = smoothstep(-bw, bw, top - y) * bedMask(x, wv, e, t);
    float base = clamp(fuel * 1.3, 0.0, 1.0);
    float bo = bc * mix(0.5, 0.9, e) * mix(0.75, 1.0, base);
    // a warm glow, orange under the bases burning hardest, deep red between them
    f += vec4(heatRamp(0.28 + mix(0.6, 1.0, e) * (0.12 * hot + 0.3 * base)) * bo, bo) * (1.0 - f.a);
  }
  vec2 dm = gl_FragCoord.xy - uMouse.xy;
  f.rgb *= 1.0 + uMouse.z * 0.25 * exp(-dot(dm, dm) / (0.02 * uVh * uVh));
  // the first flames come up softly over the first ~150 K above the Draper point
  f *= smoothstep(0.0, 0.15, e);
  gl_FragColor = vec4(min(f.rgb, vec3(1.0)), f.a);
}`;

type Pass = { gl: WebGLRenderingContext; u: (n: string) => WebGLUniformLocation | null };

// Software GL (no GPU): the renderer's name, as lib/liquid/engine.ts and lib/gl3d/core.ts tell it.
function softwareGL(gl: WebGLRenderingContext) {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return /swiftshader|llvmpipe|software|basic render/i.test(String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER)));
  } catch {
    return false;
  }
}

function makePass(canvas: HTMLCanvasElement, frag: string, opts: WebGLContextAttributes): Pass | null {
  const gl = canvas.getContext('webgl', opts);
  if (!gl) return null;
  // fwidth() for the crisp edges (supported everywhere WebGL is; without it the edge falls back to a soft one).
  const deriv = !!gl.getExtension('OES_standard_derivatives');
  const src = deriv ? `#extension GL_OES_standard_derivatives : enable\n${frag}` : frag.replace('float w = clamp(fwidth(phi), 1e-5, 0.03);', 'float w = 0.03;');
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, src));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  return { gl, u: (n) => gl.getUniformLocation(prog, n) };
}

// Heat easing: the flames follow the scroll's heat with this time constant and never faster than HEAT_RATE per
// second, so even a jump (End key, anchor, a landing scroll progress) brings the fire up over most of a second.
const HEAT_LAG = 0.3;
const HEAT_RATE = 1.1;
// The flames fade in over this long (clock seconds) from their first frame, over the CSS furnace (globals.css --gl).
const FADE_IN = 0.8;

export function startMolten({ canvas, heat, onReady, onFail }: Options): () => void {
  let flame: Pass | null = null;
  try {
    flame = makePass(canvas, FRAG, { alpha: true, premultipliedAlpha: true, antialias: false, depth: false });
  } catch (e) {
    console.warn('[crucible] molten surface disabled:', e);
    flame = null;
  }
  if (!flame) {
    onFail?.();
    return () => {};
  }
  const gl = flame.gl;
  const uRes = flame.u('uRes');
  const uVh = flame.u('uVh');
  const uTime = flame.u('uTime');
  const uK = flame.u('uK');
  const uMouse = flame.u('uMouse');
  const uCss = flame.u('uCss');
  const uSwell = flame.u('uSwell');
  const ph = new Float32Array(4);
  const scene = canvas.parentElement!;

  // Full resolution (the edges are drawn at the pixel), stepping down only on slow frames. Software GL (SwiftShader,
  // llvmpipe: CI, PageSpeed, VMs; no GPU) starts at the last step, as the liquid and the 3D do; `?liquid=full` (screenshots)
  // keeps full resolution there too.
  const scales = [1, 0.75, 0.5];
  let q = softwareGL(gl) && !/[?&]liquid=full\b/.test(location.search) ? scales.length - 1 : 0;
  let vh = 1;
  const resize = () => {
    const s = scales[q] * Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * s));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * s));
    vh = Math.max(1, (scene.clientHeight || canvas.clientHeight / FLAME_SPAN) * s);
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  const mouse = { x: 0, y: 0, s: 0, moved: -1 };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * canvas.width;
    mouse.y = (1 - (e.clientY - r.top) / r.height) * canvas.height;
    mouse.moved = clock.t;
  };
  addEventListener('pointermove', onMove, { passive: true });

  const rd = renderer('thesis', 'main');
  rd.setPaused(true);
  // t0: flow time starts at 0 (small shader coordinates); kf: the eased heat (-1 = not drawn yet); fade: the flames'
  // opacity over the CSS furnace, on the clock (a CSS transition would run on wall-clock time).
  let off: (() => void) | undefined, stopped = false, slow = 0, run = 0, t0 = -1, kf = -1, ready = false, fade = 0;
  const frame = (T: number, dt: number) => {
    if (stopped || document.hidden) return;
    if (t0 < 0) t0 = T;
    run += dt;
    if (!clockHeld()) {
      slow = dt > 0.026 ? slow + dt : Math.max(0, slow - dt * 0.5);
      if (slow > 1.5 && run > 2) {
        slow = 0;
        // Slow: render at a lower resolution (down to the last step, where it stays).
        if (q + 1 < scales.length) {
          q++;
          resize();
        }
      }
    }
    const target = Math.min(1, Math.max(0, heat()));
    if (kf < 0) kf = target;
    else {
      const step = (target - kf) * (1 - Math.exp(-dt / HEAT_LAG));
      kf += Math.max(-HEAT_RATE * dt, Math.min(HEAT_RATE * dt, step));
    }
    mouse.s += ((mouse.moved >= 0 && T - mouse.moved < 0.9 ? 1 : 0) - mouse.s) * Math.min(1, dt / 0.3);
    const r = canvas.getBoundingClientRect();
    gl.uniform2f(uCss, r.width, r.height);
    gl.uniform4fv(uSwell, swellPhases(r.left + scrollX, r.top + scrollY, T, ph));
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uVh, vh);
    gl.uniform1f(uTime, T - t0);
    gl.uniform1f(uK, kf);
    gl.uniform3f(uMouse, mouse.x, mouse.y, mouse.s);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (canvas.style.visibility) canvas.style.visibility = '';
    if (fade < 1) {
      fade = Math.min(1, fade + dt / FADE_IN);
      scene.style.setProperty('--gl', (fade * fade * (3 - 2 * fade)).toFixed(3));
    }
    canvas.dataset.t = T.toFixed(3); // field time of the last frame drawn here (screenshot checks wait on it)
    canvas.dataset.k = kf.toFixed(4); // the heat the flames were drawn at
    rd.done(T);
    if (!ready) {
      ready = true;
      onReady?.();
    }
  };
  const io = new IntersectionObserver(([e]) => {
    if (stopped) return;
    if (e.isIntersecting && !off) {
      // Back on screen: start from the heat as it is now (it may have changed a lot while away, e.g. scrolled past
      // to 1811 K, then back to the top): no ramp from a stale heat.
      kf = -1;
      off = onFrame(frame);
    } else if (!e.isIntersecting && off) {
      off();
      off = undefined;
      // Leave nothing stale behind: hidden (and cleared) until its first frame back on screen is drawn at the heat of
      // that moment. (A clear alone is not always presented while the canvas is off screen: WebKit showed the old fire.)
      canvas.style.visibility = 'hidden';
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    rd.setPaused(!off);
  });
  io.observe(canvas);
  function stop() {
    stopped = true;
    off?.();
    off = undefined;
    rd.off();
    io.disconnect();
    ro.disconnect();
    removeEventListener('pointermove', onMove);
    scene.style.removeProperty('--gl');
  }
  return stop;
}
