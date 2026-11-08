// The PayPal beat's metal (components/Story.tsx SplitBeat): a drop swells at the tip of PayPal's y, lets go, and a
// rounded, glossy stream runs down and forks into six runs, one into each name; when the pour stops the stream lets go
// of the y and drains down after itself, beading as it thins, so all of it ends up in the names. A bead falls off at
// each fork and sinks into the page's liquid (a ripple in lib/liquid). The names are real text above this canvas
// (Story.css); this draws the runs, the drops and the heat glowing under the names, transparent everywhere else.
//
// The metal is a signed distance field: each run is a chain of capsules whose radius tapers along it (a bulb leads
// the front, the draining tail beads like a thinning thread), the runs are joined with a smooth minimum (surface
// tension at the forks), and it is shaded as a rounded tube from that field: temperature colour, a key from the upper
// left, a sharp highlight, darker edges, a heat glow around it and flow marks travelling down it.
//
// Everything is a function of the pour time tau (lib/gl/splitTime.ts, from the figure's --p) plus the one clock for
// the flow marks and the names' slow warmth, so it scrubs both ways. Drawn on the one clock as renderer 'split', only
// while near the screen; quality steps by render scale (software GL starts at the last one, ?liquid=full keeps 1).
import { addSource } from '@/lib/liquid/field';
import { clockHeld, onFrame, renderer } from '@/lib/liquid/loop';
import { DRIP, FORK, LAG, PAYPAL, REACH, RUN, SWELL, clamp01, nameTimes, tauOf } from './splitTime';

const NB = 7; // the trunk, then the six runs (row by row, left then right)
const NP = 12; // points per run
const NN = 7; // PayPal, then the six names

const VERT = `#version 300 es
in vec2 aPos; void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
#define NB ${NB}
#define NP ${NP}
#define NN ${NN}
uniform vec2 uRes;       // canvas px
uniform float uScale;    // canvas px per CSS px
uniform float uTime, uEm, uWarm;
uniform vec4 uP[NB * NP];  // x, y (CSS px), s (arc length), r
uniform vec4 uB[NB];       // front s, tail s, heat (0: none), bulb
uniform vec4 uBox[NB];
uniform vec4 uDrop[3];     // x, y, r, heat
uniform vec4 uRect[NN];    // x0, y0, x1, y1
uniform vec4 uName[NN];    // fill, heat, set, direction (0 up, -1 from the right, 1 from the left)
out vec4 outColor;

float hash(float n) { return fract(sin(n) * 43758.5453); }
float noise1(float x) { float i = floor(x), f = fract(x); return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f)); }
vec3 blackbody(float t) {
  vec3 c = mix(vec3(0.05, 0.02, 0.01), vec3(0.45, 0.06, 0.0), smoothstep(0.0, 0.3, t));
  c = mix(c, vec3(1.0, 0.357, 0.122), smoothstep(0.25, 0.6, t));
  c = mix(c, vec3(1.0, 0.702, 0.278), smoothstep(0.58, 0.84, t));
  return mix(c, vec3(1.0, 0.94, 0.84), smoothstep(0.86, 1.0, t));
}
// radius along a run: a bulb leads the front; once draining, the tail thins into beads that let go one by one
float prof(float s, vec4 B, float r0) {
  float u = (B.x - s) / (r0 * 2.6);
  float m = (1.0 + B.w * exp(-u * u)) * (1.0 + 0.07 * sin(s / (r0 * 5.0) - uTime * 9.0));
  if (B.y > 0.5 && B.z < 1.5) {
    // the draining tail breaks into round beads (a circle's profile per bead, the first one centred on the tail, so
    // the end is always round), merging back into the stream further up
    float z = clamp((s - B.y) / (r0 * 9.0), 0.0, 1.0);
    float lam = r0 * 2.7, R = r0 * 1.1;
    float d = mod(s - B.y + 0.5 * lam, lam) - 0.5 * lam;
    float bead = sqrt(max(0.0, R * R - d * d)) / r0;
    m *= mix(bead, 1.0, smoothstep(0.3, 1.0, z));
  }
  return m;
}
float sdBox(vec2 p, vec4 r) {
  vec2 c = 0.5 * (r.xy + r.zw), h = 0.5 * (r.zw - r.xy);
  vec2 q = abs(p - c) - h;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uScale;
  float k = 0.07 * uEm; // surface tension: how round the forks are
  float D = 1e4, R = 1.0, S = 0.0, H = 0.0;
  vec2 G = vec2(0.0, -1.0);
  for (int b = 0; b < NB; b++) {
    vec4 B = uB[b];
    if (B.z <= 0.0) continue;
    vec4 bx = uBox[b];
    if (p.x < bx.x || p.y < bx.y || p.x > bx.z || p.y > bx.w) continue;
    float db = 1e4, rb = 1.0, sb = 0.0;
    vec2 gb = vec2(0.0, -1.0);
    for (int j = 0; j < NP - 1; j++) {
      vec4 a = uP[b * NP + j], c = uP[b * NP + j + 1];
      if (c.z < B.y || a.z > B.x) continue;
      vec2 ab = c.xy - a.xy;
      float h = clamp(dot(p - a.xy, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
      float s = clamp(mix(a.z, c.z, h), B.y, B.x);
      h = clamp((s - a.z) / max(c.z - a.z, 1e-4), 0.0, 1.0);
      vec2 q = a.xy + ab * h;
      float r0 = mix(a.w, c.w, h);
      float r = r0 * prof(s, B, r0);
      vec2 dv = p - q;
      float dl = length(dv);
      float d = dl - r;
      if (d < db) { db = d; rb = max(r, 0.3); sb = s; gb = dl > 1e-3 ? dv / dl : vec2(0.0, -1.0); }
    }
    // smooth union with what is there (polynomial smooth minimum), carrying the normal, radius and arc length along
    float hh = clamp(0.5 + 0.5 * (D - db) / k, 0.0, 1.0);
    D = mix(D, db, hh) - k * hh * (1.0 - hh);
    G = normalize(mix(G, gb, hh) + 1e-5);
    R = mix(R, rb, hh);
    S = mix(S, sb + float(b) * 1000.0, hh);
    H = mix(H, min(B.z, 1.0), hh);
  }
  // beads falling off the forks
  for (int i = 0; i < 3; i++) {
    vec4 d4 = uDrop[i];
    if (d4.w <= 0.0) continue;
    vec2 dv = p - d4.xy;
    float dl = length(dv);
    float db = dl - d4.z;
    float hh = clamp(0.5 + 0.5 * (D - db) / k, 0.0, 1.0);
    D = mix(D, db, hh) - k * hh * (1.0 - hh);
    G = normalize(mix(G, dl > 1e-3 ? dv / dl : vec2(0.0, -1.0), hh) + 1e-5);
    R = mix(R, max(d4.z, 0.3), hh);
    H = mix(H, d4.w, hh);
  }

  float aa = 0.75 / uScale;
  float inside = smoothstep(aa, -aa, D);
  // a rounded tube: x is 0 on the centre line, 1 at the edge
  float x = clamp(1.0 + D / R, 0.0, 1.0);
  float z = sqrt(max(0.0, 1.0 - x * x));
  vec3 n = normalize(vec3(G * x, z));
  vec3 L = normalize(vec3(-0.45, -0.7, 0.6));
  float spec = pow(max(dot(n, normalize(L + vec3(0.0, 0.0, 1.0))), 0.0), 48.0);
  float dif = max(dot(n, L), 0.0);
  // the surface moves: glints run down the highlight (S grows downstream); the body itself stays one smooth colour
  float fl = noise1(S / (uEm * 0.5) - uTime * 4.0) * 0.65 + noise1(S / (uEm * 0.17) - uTime * 9.0) * 0.35;
  float T = H * (0.47 + 0.36 * z + 0.06 * dif);
  vec3 col = blackbody(T) * mix(0.82, 1.0, z) + vec3(1.0, 0.95, 0.86) * spec * (0.35 + 1.1 * fl) * H;
  // heat glowing around the runs
  float gr = exp(-max(D, 0.0) / (0.3 * uEm)) * 0.42 * H;
  vec3 glowC = blackbody(0.5) * gr;
  float ga = gr * 0.85;
  // the names: hot metal glows under the filled part; set metal keeps a slow, faint warmth
  for (int i = 0; i < NN; i++) {
    vec4 rc = uRect[i], nm = uName[i];
    float span = nm.w == 0.0 ? rc.w - rc.y : rc.z - rc.x;
    float pos = nm.w == 0.0 ? (rc.w - p.y) : nm.w < 0.0 ? (rc.z - p.x) : (p.x - rc.x);
    float filled = smoothstep(nm.x * span + 0.4 * uEm, nm.x * span - 0.4 * uEm, pos) * min(1.0, nm.x * 12.0);
    // a soft pool of light under the name (an ellipse, so it never shows the box)
    vec2 c = 0.5 * (rc.xy + rc.zw), hs = 0.5 * (rc.zw - rc.xy) + vec2(0.45, 0.35) * uEm;
    vec2 e = (p - c) / hs;
    float pool = exp(-2.4 * dot(e, e));
    float hot = nm.y * filled * (1.0 - nm.z);
    float g1 = pool * 0.34 * hot;
    float breathe = 0.6 + 0.4 * sin(uTime * (0.45 + 0.06 * float(i)) + float(i) * 2.1);
    float g2 = pool * uWarm * nm.z * breathe;
    glowC += blackbody(0.5 + 0.25 * nm.y) * g1 + blackbody(0.42) * g2;
    ga += (g1 + g2) * 0.9;
  }
  ga = min(ga, 0.9);
  glowC = min(glowC, vec3(ga));
  outColor = vec4(col * inside + glowC * (1.0 - inside), inside + ga * (1.0 - inside));
}`;

type Pt = [number, number];
type Run = { pts: Float32Array; len: number; box: number[] };
type Geo = { em: number; trunk: Run; runs: Run[]; forkS: number[]; forks: Pt[]; rects: number[][]; dirs: number[]; spout: Pt; ox: number; oy: number; centers: Pt[] };

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Resample a curve (fn of u 0..1) into NP points at equal arc length, with radius r(u along length). */
function runOf(fn: (u: number) => Pt, r: (v: number) => number, pad: number): Run {
  const N = 96;
  const raw: Pt[] = [];
  const acc = [0];
  for (let i = 0; i <= N; i++) {
    raw.push(fn(i / N));
    if (i) acc.push(acc[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]));
  }
  const len = acc[N];
  const pts = new Float32Array(NP * 4);
  const box = [1e9, 1e9, -1e9, -1e9];
  let j = 0;
  for (let i = 0; i < NP; i++) {
    const s = (len * i) / (NP - 1);
    while (j < N - 1 && acc[j + 1] < s) j++;
    const f = (s - acc[j]) / Math.max(1e-6, acc[j + 1] - acc[j]);
    const x = raw[j][0] + (raw[j + 1][0] - raw[j][0]) * f;
    const y = raw[j][1] + (raw[j + 1][1] - raw[j][1]) * f;
    const rr = r(s / len);
    pts.set([x, y, s, rr], i * 4);
    box[0] = Math.min(box[0], x - pad);
    box[1] = Math.min(box[1], y - pad);
    box[2] = Math.max(box[2], x + pad);
    box[3] = Math.max(box[3], y + pad);
  }
  return { pts, len, box };
}

const cubic = (a: Pt, b: Pt, c: Pt, d: Pt) => (u: number): Pt => {
  const v = 1 - u;
  return [v * v * v * a[0] + 3 * v * v * u * b[0] + 3 * v * u * u * c[0] + u * u * u * d[0], v * v * v * a[1] + 3 * v * v * u * b[1] + 3 * v * u * u * c[1] + u * u * u * d[1]];
};

/** Monotone cubic (Fritsch-Carlson) through knots: the stream's front moves on smoothly as it passes each fork. */
function monotone(xs: number[], ys: number[], m0: number) {
  const n = xs.length;
  const d = xs.slice(1).map((x, i) => (ys[i + 1] - ys[i]) / (x - xs[i]));
  const m = [m0, ...d.slice(1).map((v, i) => (v * d[i] <= 0 ? 0 : (2 * v * d[i]) / (v + d[i]))), d[n - 2]];
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

/** Reads the layout (offset* ignore the figure's float translate) and builds the runs in canvas CSS px. */
function measure(sp: HTMLElement, canvas: HTMLCanvasElement): Geo {
  const em = parseFloat(getComputedStyle(sp).fontSize);
  const ox = -canvas.offsetLeft;
  const oy = -canvas.offsetTop;
  const W = sp.clientWidth;
  const head = sp.querySelector<HTMLElement>('.sp-head')!;
  const names = [...sp.querySelectorAll<HTMLElement>('.sp-l, .sp-r')];
  const hs = parseFloat(getComputedStyle(head).fontSize);
  const ax = W / 2 + ox;
  // the tip of the y (the CSS puts it on the axis): just inside the descender, so the drop grows out of the ink
  const spout: Pt = [ax, oy + head.offsetTop + hs * 0.99];
  const rects: number[][] = [];
  const dirs: number[] = [];
  const centers: Pt[] = [];
  // PayPal's rect is its real (translated) box
  const hx = head.offsetLeft + ox - head.offsetWidth / 2 + parseFloat(getComputedStyle(head).getPropertyValue('--spout')) * hs;
  rects.push([hx, head.offsetTop + oy + hs * 0.12, hx + head.offsetWidth, head.offsetTop + oy + hs * 0.9]);
  dirs.push(0);
  centers.push([hx + head.offsetWidth / 2, head.offsetTop + oy + hs * 0.5]);
  const ends: Pt[] = [];
  for (const el of names) {
    const left = el.classList.contains('sp-l');
    const x0 = el.offsetLeft + ox, y0 = el.offsetTop + oy, w = el.offsetWidth, h = el.offsetHeight;
    rects.push([x0, y0, x0 + w, y0 + h]);
    dirs.push(left ? -1 : 1);
    centers.push([x0 + w / 2, y0 + h / 2]);
    const inset = parseFloat(el.dataset.in ?? '0.06') * em;
    ends.push([left ? x0 + w - inset : x0 + inset, y0 + h * 0.6]);
  }
  const rT = [0.15 * em, 0.11 * em];
  const rR = [0.1 * em, 0.062 * em];
  const pad = 1.3 * em; // the glow reaches this far
  // the trunk falls straight from the spout to the last fork
  const forkY = [0, 1, 2].map((k) => ends[k * 2][1] - 0.95 * em);
  const top: Pt = [ax, spout[1]];
  const bottom: Pt = [ax, forkY[2]];
  // a thin neck where it leaves the lip of the y, swelling as it falls, then tapering as the runs take metal off
  const tl = bottom[1] - top[1];
  const trunk = runOf(
    (u) => [ax, top[1] + tl * u],
    (v) => (rT[0] + (rT[1] - rT[0]) * v) * (0.55 + 0.45 * smooth(clamp01((v * tl) / (0.5 * em)))),
    pad,
  );
  const forkS = forkY.map((y) => y - top[1]);
  const forks: Pt[] = forkY.map((y) => [ax, y]);
  // each run leaves its fork downwards (the way the metal is going) and curves out into its name, level with it
  const runs = ends.map((e, i) => {
    const f = forks[i >> 1];
    const r0 = i >> 1 === 2 ? rT[1] : rR[0];
    return runOf(cubic(f, [f[0] + (e[0] - f[0]) * 0.1, f[1] + (e[1] - f[1]) * 0.6], [f[0] + (e[0] - f[0]) * 0.4, e[1]], e), (v) => r0 + (rR[1] - r0) * smooth(v), pad);
  });
  return { em, trunk, runs, forkS, forks, rects, dirs, spout, ox, oy, centers };
}

type Options = { box: HTMLElement; canvas: HTMLCanvasElement; onFail?: () => void };

/** Starts the beat's metal; returns the stop. */
export function startSplitPour({ box, canvas, onFail }: Options): () => void {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
  if (!gl) {
    onFail?.();
    return () => {};
  }
  const sp = canvas.parentElement!;
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
    return s;
  };
  const prog = gl.createProgram()!;
  try {
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link');
  } catch (e) {
    console.warn('[crucible] PayPal pour disabled:', e);
    onFail?.();
    return () => {};
  }
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const u = (n: string) => gl.getUniformLocation(prog, n);
  const U = { res: u('uRes'), scale: u('uScale'), time: u('uTime'), em: u('uEm'), warm: u('uWarm'), P: u('uP'), B: u('uB'), box: u('uBox'), drop: u('uDrop'), rect: u('uRect'), name: u('uName') };

  const soft = (() => {
    try {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return /swiftshader|llvmpipe|software|basic render/i.test(String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER)));
    } catch {
      return false;
    }
  })();
  const full = /[?&]liquid=full\b/.test(location.search);
  const scales = [1, 0.75, 0.5];
  let q = soft && !full ? scales.length - 1 : 0;
  let scale = 1;
  let geo: Geo | null = null;
  let front: (t: number) => number = () => 0;
  const P = new Float32Array(NB * NP * 4);
  const BOX = new Float32Array(NB * 4);
  const RECT = new Float32Array(NN * 4);
  const resize = () => {
    scale = scales[q] * Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
    geo = measure(sp, canvas);
    const runs = [geo.trunk, ...geo.runs];
    runs.forEach((r, i) => {
      P.set(r.pts, i * NP * 4);
      BOX.set(r.box, i * 4);
    });
    geo.rects.forEach((r, i) => RECT.set(r, i * 4));
    const L = geo.trunk.len;
    // the front leaves the spout gently (the drop letting go), then passes each fork on its time
    front = monotone([RUN, FORK[0], FORK[1], FORK[2]], [0.1 * geo.em, geo.forkS[0], geo.forkS[1], L], (0.25 * geo.forkS[0]) / (FORK[0] - RUN));
    dirty = true;
  };
  let dirty = true;
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  ro.observe(sp);
  resize();

  const B = new Float32Array(NB * 4);
  const DROP = new Float32Array(12);
  const NAME = new Float32Array(NN * 4);
  const times = [PAYPAL, ...[0, 0, 1, 1, 2, 2].map(nameTimes)];

  /** One run's front/tail/heat/bulb. When the run has nearly drained, its last metal gathers (surface tension) into one
   * round bead at its end that shrinks into the name or the fork: heat 2 tells the shader to draw it as a plain bead
   * (no taper, no beading), so it never ends in a point. */
  function setRun(i: number, fr: number, tl: number, alive: boolean, bulb: number, run: Run) {
    const rEnd = run.pts[(NP - 1) * 4 + 3];
    const gather = 7 * rEnd;
    const rem = fr - tl;
    if (alive && tl > 0.5 && rem < gather) {
      const v = Math.max(0, rem / gather);
      B.set([fr, fr - Math.min(rem, 0.5 * rEnd) * v, 2, 1.25 * Math.sqrt(v) - 1], i * 4);
    } else B.set([fr, tl, alive ? 1 : 0, bulb], i * 4);
  }

  /** Everything for pour time tau. */
  function state(tau: number) {
    const g = geo!;
    // the trunk: before it runs, a drop swelling at the spout
    const sw = smooth(clamp01((tau - SWELL[0]) / (SWELL[1] - SWELL[0])));
    const fT = tau < RUN ? 0.1 * g.em * sw : front(tau);
    const tT = tau < RUN + LAG ? 0 : front(tau - LAG);
    const trunkAlive = sw > 0 && tT < g.trunk.len - 0.5;
    setRun(0, fT, tT, trunkAlive, tau < RUN ? -0.75 + 1.05 * sw : 0.38, g.trunk);
    // a run: its front leaves the fork when the trunk's front gets there, the tail when the trunk's tail does
    for (let i = 0; i < 6; i++) {
      const row = i >> 1;
      const r = g.runs[i];
      const go = (t: number) => {
        const v = clamp01((t - FORK[row]) / REACH);
        return r.len * (0.55 * v + 0.45 * (1 - (1 - v) * (1 - v)));
      };
      const fr = go(tau);
      const tl = tau - LAG <= FORK[row] ? 0 : go(tau - LAG);
      const alive = tau > FORK[row] && tl < r.len - 0.5;
      setRun(i + 1, fr, tl, alive, 0.32, r);
    }
    // a bead falls off each fork as the tail passes, and sinks
    for (let k = 0; k < 3; k++) {
      const t0 = FORK[k] + LAG;
      const v = (tau - t0) / DRIP;
      const on = v > 0 && v < 1;
      const f = g.forks[k];
      const rr = 0.1 * g.em * Math.sqrt(Math.max(0, 1 - v)) * smooth(clamp01(v * 5));
      DROP.set(on ? [f[0], f[1] + (0.25 + 0.75 * v * v) * 0.7 * g.em, rr, 1 - v * 0.6] : [0, 0, 0, 0], k * 4);
    }
    for (let i = 0; i < NN; i++) {
      const w = times[i];
      NAME.set([clamp01((tau - w.a) / w.d), 1 - clamp01((tau - w.c) / w.cd), clamp01((tau - w.ks) / w.kd), g.dirs[i]], i * 4);
    }
  }

  // ripples in the page's liquid where the metal meets it: forward only, and not for a jump across the whole beat
  const events = () => {
    const g = geo!;
    const ev: { t: number; at: Pt; amp: number }[] = [{ t: RUN, at: g.spout, amp: 0.06 }];
    for (let k = 0; k < 3; k++) ev.push({ t: FORK[k] + LAG + DRIP, at: [g.forks[k][0], g.forks[k][1] + 0.7 * g.em], amp: 0.08 });
    for (let i = 1; i < NN; i++) ev.push({ t: times[i].a + times[i].d, at: g.centers[i], amp: 0.05 });
    return ev;
  };
  const ripple = (from: number, to: number) => {
    if (to <= from || to - from > 0.12) return;
    const r = canvas.getBoundingClientRect();
    for (const e of events()) if (from < e.t && e.t <= to) addSource(r.left + (e.at[0] / canvas.clientWidth) * r.width, r.top + scrollY + (e.at[1] / canvas.clientHeight) * r.height, e.amp, 10, { kind: 'float' });
  };

  // test hook: the runs (canvas CSS px) and the pour time
  (window as unknown as { __split?: object }).__split = { geo: () => geo, tau: () => lastTau };
  const rd = renderer('split', 'main');
  rd.setPaused(true);
  let off: (() => void) | undefined;
  let stopped = false, slow = 0, run = 0, fade = 0, lastTau = -1, lastDraw = -1;
  const fig = sp.closest<HTMLElement>('figure')!;
  const frame = (T: number, dt: number) => {
    if (stopped || document.hidden || !geo) return;
    run += dt;
    const tau = tauOf(parseFloat(fig.style.getPropertyValue('--p') || '0'));
    if (lastTau >= 0) ripple(lastTau, tau);
    // nothing to draw before the pour: one clear, then idle
    const blank = tau <= SWELL[0];
    const flowing = tau > SWELL[0] && tau < FORK[2] + REACH + LAG + 0.02;
    // after the pour only the names' slow warmth moves: 30 fps is plenty
    const due = dirty || tau !== lastTau || flowing || (!blank && T - lastDraw > 1 / 30);
    lastTau = tau;
    if (!due) {
      rd.done(T);
      return;
    }
    if (!clockHeld() && !full) {
      slow = dt > 0.026 ? slow + dt : Math.max(0, slow - dt * 0.5);
      if (slow > 1.2 && run > 1.5 && q + 1 < scales.length) {
        slow = 0;
        q++;
        resize();
      }
    }
    dirty = false;
    lastDraw = T;
    if (blank) {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    } else {
      state(tau);
      gl.uniform2f(U.res, canvas.width, canvas.height);
      gl.uniform1f(U.scale, canvas.width / canvas.clientWidth);
      gl.uniform1f(U.time, T % 1000);
      gl.uniform1f(U.em, geo.em);
      gl.uniform1f(U.warm, 0.2);
      gl.uniform4fv(U.P, P);
      gl.uniform4fv(U.B, B);
      gl.uniform4fv(U.box, BOX);
      gl.uniform4fv(U.drop, DROP);
      gl.uniform4fv(U.rect, RECT);
      gl.uniform4fv(U.name, NAME);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    if (fade < 1) {
      fade = Math.min(1, fade + dt / 0.5);
      sp.style.setProperty('--gl', smooth(fade).toFixed(3));
    }
    rd.done(T);
  };
  const io = new IntersectionObserver(
    ([e]) => {
      if (stopped) return;
      if (e.isIntersecting && !off) {
        dirty = true;
        off = onFrame(frame);
      } else if (!e.isIntersecting && off) {
        off();
        off = undefined;
        lastTau = -1;
      }
      rd.setPaused(!off);
    },
    { rootMargin: '30% 0px 30% 0px' },
  );
  io.observe(box);
  return () => {
    stopped = true;
    off?.();
    rd.off();
    io.disconnect();
    ro.disconnect();
    sp.style.removeProperty('--gl');
  };
}
