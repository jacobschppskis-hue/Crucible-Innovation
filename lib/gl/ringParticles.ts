// Rich tier: the Split Ring as molten metal (WebGL 1, no libraries).
//
// The same dot matrix the intro pours (lib/splitRing.ts `dotRows`/`pixels`): three rows of dots along each arc and a
// 3 × 3 grid in each pixel. At rest the solid SVG ring shows; as the scroll story starts the ring melts into these
// dots (glowing orange on the way), the pixels come apart dot by dot, the line's dots drift along it, and at the
// fusion it sets solid again. Everything is computed in the vertex shader from per-dot constants plus a handful of
// uniforms, so there's no per-frame CPU work beyond one rect read, and nothing is drawn while the ring is solid.
import { RING, dotRows, pixels } from '@/lib/splitRing';
import { dropToLight, richForced } from '@/lib/tier';

type State = { sm: number; sh: number; core: number; flare: number; out: number; melt: number };
type Options = { canvas: HTMLCanvasElement; ring: Element; state: State; onReady?: () => void; onFail?: () => void };

const { core: CORE_R, rings: RINGS } = RING;
const DOT = 0.82; // dot diameter in ring units, as in the intro's mask
const FLOW = 0.9; // dots per second drifting along the arcs
const f1 = (n: number) => n.toFixed(4);
const VERT = `
precision highp float;
attribute vec2 aHome;
attribute vec4 aInfo;   // group (0,1 arc dots · 2 pixel dots · 3 core · 4 sparks), order, rand, rand
attribute vec2 aScat;
uniform vec2 uCenter, uView;
uniform float uScale, uDpr, uTime, uMaxPoint;
uniform float uSm, uSh, uCore, uFlare, uBloom, uHeat;
uniform vec3 uMouse;
varying vec4 vCol;
varying float vSize;

const vec3 BONE = vec3(0.91, 0.894, 0.847);
const vec3 EMBER = vec3(1.0, 0.357, 0.122);
const vec3 HOT = vec3(1.0, 0.702, 0.278);
const vec3 WHITE = vec3(1.0, 0.96, 0.9);

vec3 temp(float t) {
  t = clamp(t, 0.0, 1.0);
  if (t < 0.45) return mix(BONE, EMBER, t / 0.45);
  if (t < 0.8) return mix(EMBER, HOT, (t - 0.45) / 0.35);
  return mix(HOT, WHITE, (t - 0.8) / 0.2);
}

void main() {
  float g = aInfo.x, ord = aInfo.y, r1 = aInfo.z, r2 = aInfo.w;
  vec2 p = aHome;
  float heat = uHeat, alpha = 1.0, size = ${f1(DOT)};
  // Molten shimmer: each dot flickers a little on its own (no travelling pulses).
  float shimmer = 0.5 + 0.5 * sin(uTime * (1.3 + r1 * 1.7) + r2 * 40.0);

  if (g < 1.5) {
    // Human: the rows drift slowly along the arc (top to bottom), fading in and out at the ends.
    float n = g < 0.5 ? ${f1(dotRows(RINGS[0].r)[0].n)} : ${f1(dotRows(RINGS[1].r)[0].n)};
    float o = fract(ord + uTime * ${f1(FLOW)} / n);
    float a = 4.712389 - o * 3.141593;
    p = vec2(cos(a), sin(a)) * length(aHome);
    alpha *= smoothstep(0.0, 1.0 / n, o) * smoothstep(1.0, 1.0 - 1.0 / n, o);
    heat += shimmer * 0.06;
    // "Not the model.": the human half leaves to the left.
    float q = clamp(uSh * 1.5 - r1 * 0.5, 0.0, 1.0);
    p += vec2(-9.0 - r2 * 6.0, (r1 - 0.5) * 6.0) * q;
    alpha *= 1.0 - 0.82 * uSh;
  } else if (g < 2.5) {
    // Machine: each pixel's grid comes apart dot by dot ("Not the person.").
    float q = clamp(uSm * 1.6 - ord * 0.6, 0.0, 1.0);
    q = q * q * (3.0 - 2.0 * q);
    p += (aScat + vec2(sin(uTime * 0.7 + r1 * 9.0), cos(uTime * 0.6 + r2 * 9.0)) * 2.0 * q) * q;
    alpha *= 1.0 - 0.55 * q;
    heat += q * 0.15 + shimmer * 0.06;
  } else if (g < 3.5) {
    // Core: a molten pool, scaled by uCore, swelling with the fusion flare.
    float k = 0.25 + 0.75 * uCore + uFlare * 0.5;
    p *= k;
    p += vec2(sin(uTime * 2.0 + r1 * 20.0), cos(uTime * 1.7 + r2 * 20.0)) * 0.15;
    float rc = length(aHome) / ${f1(CORE_R)};
    heat = 0.48 + 0.3 * (1.0 - rc) + uFlare * 0.45;
    alpha *= uCore * 0.6;
    size = 1.0 - rc * 0.35;
  } else {
    // Sparks: thrown off the core by the fusion flare, rising and cooling.
    float speed = 0.18 + r1 * 0.22;
    float age = fract(uTime * speed + r2);
    float side = (r1 - 0.5) * 2.0;
    p = aHome + vec2(side * 10.0 * age + sin(uTime * 1.3 + r2 * 40.0) * 2.0 * age, -age * (26.0 + r2 * 20.0) + age * age * 6.0);
    heat = 1.0 - age * 0.9;
    alpha = (1.0 - age) * (1.0 - age) * uFlare * 2.2 * uCore;
    size = 0.35 + (1.0 - age) * 0.25;
  }

  // The cursor stirs the metal: dots part around it and heat up.
  vec2 d = p - uMouse.xy;
  float f = exp(-dot(d, d) / 40.0) * uMouse.z;
  p += d / (length(d) + 0.001) * f * 3.0;
  heat += f * 0.7;

  // Fusion flare: a radial kick and a flash of heat from the core.
  float rr = length(p);
  heat += uFlare * exp(-rr * 0.05) * 0.9;
  p += p / (rr + 0.001) * uFlare * 2.2 * exp(-rr * 0.03);

  // Bloom pass: the same dots drawn again, large and faint, as a glow around the hot metal.
  size *= 1.0 + uBloom * 3.0;
  alpha *= 1.0 - uBloom * (1.0 - clamp(heat, 0.0, 1.0) * 0.12);

  vec2 px = uCenter + p * uScale;
  gl_Position = vec4(px / uView * 2.0 - 1.0, 0.0, 1.0);
  gl_Position.y = -gl_Position.y;
  gl_PointSize = clamp(size * uScale * uDpr, 1.0, uMaxPoint);
  vSize = gl_PointSize;
  vCol = vec4(temp(heat) * alpha, alpha);
}`;

const FRAG = `
precision mediump float;
varying vec4 vCol;
varying float vSize;
void main() {
  // A crisp round dot, anti-aliased over about one device pixel.
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = 1.0 - smoothstep(1.0 - 2.0 / max(vSize, 1.0), 1.0, r);
  if (a <= 0.0) discard;
  gl_FragColor = vCol * a;
}`;

/** Per-dot constants. Ring units: the 64-unit viewBox, centred, y down. */
function build() {
  const home: number[] = [];
  const info: number[] = [];
  const scat: number[] = [];
  const rnd = mulberry(7);
  const add = (x: number, y: number, g: number, ord: number, sx = 0, sy = 0) => {
    home.push(x, y);
    info.push(g, ord, rnd(), rnd());
    scat.push(sx, sy);
  };

  // Human arcs: three rows per arc, the same count in each so they line up radially; ordered top → bottom.
  RINGS.forEach(({ r }, ri) => {
    for (const { R, n } of dotRows(r))
      for (let i = 0; i < n; i++) {
        const ord = (i + 0.5) / n;
        const a = (Math.PI * 3) / 2 - ord * Math.PI;
        add(Math.cos(a) * R, Math.sin(a) * R, ri, ord);
      }
  });

  // Machine pixels: a 3 × 3 grid in each, turned with it; each pixel flies off its own way, its dots spreading.
  const total = RINGS.reduce((s, r) => s + r.n, 0);
  let k = 0;
  RINGS.forEach(({ r, n }) => {
    pixels(r, n, 0).forEach(({ x, y, deg }) => {
      const a = (deg * Math.PI) / 180;
      const h = mulberry(k * 31 + 5);
      const sx = 16 + h() * 44;
      const sy = (h() - 0.5) * 64;
      for (const u of [-1, 0, 1])
        for (const v of [-1, 0, 1])
          add(x + u * Math.cos(a) - v * Math.sin(a), y + u * Math.sin(a) + v * Math.cos(a), 2, k / (total - 1), sx + (rnd() - 0.5) * 10, sy + (rnd() - 0.5) * 10);
      k++;
    });
  });

  // Core.
  for (let i = 0; i < 90; i++) {
    const a = rnd() * Math.PI * 2;
    const rr = Math.sqrt(rnd()) * CORE_R;
    add(Math.cos(a) * rr, Math.sin(a) * rr, 3, 0);
  }

  // Sparks.
  for (let i = 0; i < 160; i++) add((rnd() - 0.5) * 4, (rnd() - 0.5) * 3, 4, 0);

  return { home: new Float32Array(home), info: new Float32Array(info), scat: new Float32Array(scat), count: home.length / 2 };
}

function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Starts the molten ring on `canvas`, following `ring`'s on-screen box. Returns a stop function. */
export function startRing({ canvas, ring, state, onReady, onFail }: Options): () => void {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'high-performance' });
  if (!gl) {
    onFail?.();
    return () => {};
  }
  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
    return s;
  };
  let prog: WebGLProgram;
  try {
    prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link');
  } catch (e) {
    console.warn('[crucible] molten ring disabled:', e);
    onFail?.();
    return () => {};
  }
  gl.useProgram(prog);

  const touch = matchMedia('(hover: none)').matches;
  const data = build();
  const attr = (name: string, arr: Float32Array, size: number) => {
    const loc = gl.getAttribLocation(prog, name);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  };
  attr('aHome', data.home, 2);
  attr('aInfo', data.info, 4);
  attr('aScat', data.scat, 2);
  const u = Object.fromEntries(
    ['uCenter', 'uView', 'uScale', 'uDpr', 'uTime', 'uSm', 'uSh', 'uCore', 'uFlare', 'uBloom', 'uHeat', 'uMouse', 'uMaxPoint'].map((n) => [n, gl.getUniformLocation(prog, n)]),
  );
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);
  gl.uniform1f(u.uMaxPoint, (gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array)[1] || 64);

  // Quality steps down if frames run long: full DPR → 1 → 0.75, then give up and go back to the SVG.
  const maxDpr = Math.min(devicePixelRatio || 1, touch ? 1.75 : 2);
  const steps = [maxDpr, Math.min(maxDpr, 1), 0.75];
  let quality = 0;
  let dpr = steps[0];
  let w = 0;
  let h = 0;
  const resize = () => {
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  // Cursor in page coordinates; its strength rises while it moves and fades when it rests.
  const mouse = { x: -1e4, y: -1e4, s: 0, target: 0, moved: 0 };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.moved = performance.now();
  };
  addEventListener('pointermove', onMove, { passive: true });
  // While the ring is solid nothing runs; a scroll wakes the loop, which then runs until the ring has set again.
  let scrolled = 0;
  const onScroll = () => {
    scrolled = performance.now();
    loop();
  };
  addEventListener('scroll', onScroll, { passive: true });

  let raf = 0;
  let visible = true;
  let last = 0;
  let slow = 0;
  let ready = false;
  let lost = false;
  let drawn = true; // whether the canvas has anything on it
  let melting = 0; // ms the ring has been molten, for the frame-time check
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) loop();
  });
  io.observe(canvas);
  const onVis = () => !document.hidden && loop();
  document.addEventListener('visibilitychange', onVis);
  const onLost = (e: Event) => {
    e.preventDefault();
    lost = true;
    fail();
  };
  canvas.addEventListener('webglcontextlost', onLost);

  const frame = (now: number) => {
    raf = 0;
    if (!visible || document.hidden || lost) return;
    const dt = last ? now - last : 16;
    last = now;
    if (!ready) {
      ready = true;
      onReady?.();
    }
    // Solid ring: the SVG shows and there's nothing to draw. Sleep once the scrolling has settled.
    if (state.melt < 0.002) {
      if (drawn) gl.clear(gl.COLOR_BUFFER_BIT);
      drawn = false;
      melting = 0;
      last = 0;
      if (now - scrolled < 1500) raf = requestAnimationFrame(frame);
      return;
    }
    raf = requestAnimationFrame(frame);
    drawn = true;
    melting += dt;
    // Long frames for ~1.5 s in a row while molten: step quality down.
    slow = dt > 24 ? slow + dt : Math.max(0, slow - dt * 0.5);
    if (slow > 1500 && melting > 1200) {
      slow = 0;
      if (quality + 1 >= steps.length) {
        if (!richForced()) return fail();
      } else quality++;
      dpr = steps[quality];
      resize();
    }

    const r = ring.getBoundingClientRect();
    const cr = canvas.getBoundingClientRect();
    const scale = r.width / 64;
    const cx = r.left + r.width / 2 - cr.left;
    const cy = r.top + r.height / 2 - cr.top;
    mouse.target = now - mouse.moved < 900 ? 1 : 0;
    mouse.s += (mouse.target - mouse.s) * Math.min(1, dt / 220);
    // Orange while it changes state (melting or setting), bone once molten.
    const m = state.melt;
    const heat = Math.min(1, m * (1 - m) * 4) * 0.62;

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(u.uCenter, cx, cy);
    gl.uniform2f(u.uView, w, h);
    gl.uniform1f(u.uScale, scale);
    gl.uniform1f(u.uDpr, dpr);
    gl.uniform1f(u.uTime, now / 1000);
    gl.uniform1f(u.uSm, state.sm);
    gl.uniform1f(u.uSh, state.sh);
    gl.uniform1f(u.uCore, Math.min(1, state.core));
    gl.uniform1f(u.uFlare, state.flare);
    gl.uniform1f(u.uHeat, heat);
    gl.uniform3f(u.uMouse, (mouse.x - (r.left + r.width / 2)) / scale, (mouse.y - (r.top + r.height / 2)) / scale, mouse.s);
    gl.uniform1f(u.uBloom, 1);
    gl.drawArrays(gl.POINTS, 0, data.count);
    gl.uniform1f(u.uBloom, 0);
    gl.drawArrays(gl.POINTS, 0, data.count);
  };
  function loop() {
    if (!raf && !lost) raf = requestAnimationFrame(frame);
  }
  function fail() {
    stop();
    dropToLight();
    onFail?.();
  }
  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
    lost = true;
    io.disconnect();
    ro.disconnect();
    removeEventListener('pointermove', onMove);
    removeEventListener('scroll', onScroll);
    document.removeEventListener('visibilitychange', onVis);
    canvas.removeEventListener('webglcontextlost', onLost);
  }
  loop();
  return stop;
}
