// Rich tier: the Split Ring as ~10k particles (WebGL 1, no libraries).
//
// The human half is loose, round particles that flow along the arcs; the machine half is hard square pixels on a
// grid; the core is white-hot and throws off sparks. Everything is computed in the vertex shader from per-particle
// constants plus a handful of uniforms (time, scroll state, cursor), so there is no per-frame CPU work beyond
// one rect read. It follows the SVG ring's on-screen box exactly, so the handoff from SVG is seamless.
import { RING, pixels } from '@/lib/splitRing';
import { dropToLight, richForced } from '@/lib/tier';

type State = { sm: number; sh: number; core: number; flare: number; out: number };
type Options = { canvas: HTMLCanvasElement; ring: Element; state: State; onReady?: () => void; onFail?: () => void };

const { core: CORE_R, stroke: STROKE, rings: RINGS } = RING;
const f1 = (n: number) => n.toFixed(2);
const VERT = `
precision highp float;
attribute vec2 aHome;
attribute vec4 aInfo;   // group (0,1 arcs · 2 pixel grains · 3 core · 4 sparks · 5 whole pixels), order, rand, rand
attribute vec2 aScat;
attribute float aAng;  // pixel rotation (machine half)
uniform vec2 uCenter, uView;
uniform float uScale, uDpr, uTime, uLife;
uniform float uSm, uSh, uCore, uFlare, uBloom;
uniform vec3 uMouse;
varying vec4 vCol;
varying float vSquare;
varying vec2 vRot;
varying float vSize;
uniform float uMaxPoint;

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
  float heat = 0.0, alpha = 0.9, size = 0.42;
  vSquare = 0.0;
  vRot = vec2(cos(aAng), sin(aAng));

  if (g < 1.5) {
    // Human: particles stream slowly along the arc (top to bottom) and breathe across the stroke. Brightest along
    // the middle of the stroke, like a lit tube; a slow pulse of heat runs down it.
    float R = g < 0.5 ? ${f1(RINGS[0].r)} : ${f1(RINGS[1].r)};
    float across = (length(aHome) - R) / ${f1(STROKE / 2)};
    float o = fract(ord + uTime * (0.006 + r1 * 0.01));
    float a = 4.712389 - o * 3.141593;
    float r = R + across * ${f1(STROKE / 2)} + sin(uTime * 1.3 + r2 * 31.0 + a * 7.0) * 0.12;
    p = vec2(cos(a), sin(a)) * r;
    heat += pow(0.5 + 0.5 * sin(o * 16.0 - uTime * 1.6 + g * 2.1), 14.0) * 0.3;
    alpha *= 0.75 * (0.5 + 0.5 * (1.0 - across * across)) * smoothstep(0.0, 0.025, o) * smoothstep(1.0, 0.975, o);
    float q = clamp(uSh * 1.5 - r1 * 0.5, 0.0, 1.0);
    p += vec2(-9.0 - r2 * 6.0, (r1 - 0.5) * 6.0) * q;
    alpha *= 1.0 - 0.82 * uSh;
    size = 0.36 + r2 * 0.14;
  } else if (g < 2.5) {
    // Machine, breaking up: each pixel is also a grid of tiny pixels, shown only once it comes loose on scroll.
    vSquare = 1.0;
    float q = clamp(uSm * 1.6 - ord * 0.6, 0.0, 1.0);
    q = q * q * (3.0 - 2.0 * q);
    p += (aScat + vec2(sin(uTime * 0.7 + r1 * 9.0), cos(uTime * 0.6 + r2 * 9.0)) * 2.0 * q) * q;
    alpha *= smoothstep(0.0, 0.25, q) * (1.0 - 0.7 * q);
    heat += q * 0.15;
    size = ${f1((RING.px / 6) * 0.94 * Math.SQRT2)}; // sprite is the rotated square's bounding box
  } else if (g < 3.5) {
    // Core: white-hot, scaled by uCore, swelling with the fusion flare. Big soft points blend into a smooth glow.
    float k = 0.25 + 0.75 * uCore + uFlare * 0.5;
    p *= k;
    p += vec2(sin(uTime * 2.0 + r1 * 20.0), cos(uTime * 1.7 + r2 * 20.0)) * 0.2;
    float rc = length(aHome) / ${f1(CORE_R)};
    heat = 0.6 + 0.4 * (1.0 - rc) + uFlare * 0.4;
    alpha *= uCore * 0.5;
    size = 1.1 - rc * 0.4;
  } else if (g > 4.5) {
    // Machine, whole: one crisp pixel, turned to follow the ring, with the odd digital flicker.
    vSquare = 1.0;
    float q = clamp(uSm * 1.6 - ord * 0.6, 0.0, 1.0);
    q = q * q * (3.0 - 2.0 * q);
    p += aScat * q;
    alpha *= 1.0 - smoothstep(0.0, 0.3, q);
    heat += step(0.993, fract(sin(floor(uTime * 4.0) * 12.9 + ord * 78.2) * 43758.5)) * 0.14;
    size = ${f1(RING.px * Math.SQRT2)};
  } else {
    // Sparks: born at the core, rising and drifting, cooling as they go.
    float speed = 0.18 + r1 * 0.22;
    float age = fract(uTime * speed + r2);
    float side = (r1 - 0.5) * 2.0;
    p = aHome + vec2(side * 10.0 * age + sin(uTime * 1.3 + r2 * 40.0) * 2.0 * age, -age * (26.0 + r2 * 20.0) + age * age * 6.0);
    heat = 1.0 - age * 0.9;
    alpha = (1.0 - age) * (1.0 - age) * (0.25 + uFlare * 2.0) * uCore;
    size = 0.35 + (1.0 - age) * 0.25;
  }

  // The cursor stirs the metal: particles part around it and heat up.
  vec2 d = p - uMouse.xy;
  float f = exp(-dot(d, d) / 40.0) * uMouse.z;
  p += d / (length(d) + 0.001) * f * 3.0;
  heat += f * 0.7;

  // Fusion flare: a radial kick and a flash of heat from the core.
  float rr = length(p);
  heat += uFlare * exp(-rr * 0.05) * 0.9;
  p += p / (rr + 0.001) * uFlare * 2.2 * exp(-rr * 0.03);

  // Handoff from the SVG: a heat wave runs out from the core as the particles take over.
  float wave = uLife * 34.0;
  float w = exp(-pow(rr - wave, 2.0) / 28.0) * (1.0 - smoothstep(1.2, 2.0, uLife));
  p += p / (rr + 0.001) * w * 1.1;
  heat += w * 0.8;
  alpha *= smoothstep(0.0, 0.6, uLife);

  // Bloom pass: the same particles drawn again, large and faint, for a soft glow around the hot metal.
  size *= 1.0 + uBloom * 3.5;
  alpha *= 1.0 - uBloom * (g > 1.5 && g < 2.5 || g > 4.5 ? 0.99 : 0.95);

  vec2 px = uCenter + p * uScale;
  gl_Position = vec4(px / uView * 2.0 - 1.0, 0.0, 1.0);
  gl_Position.y = -gl_Position.y;
  gl_PointSize = clamp(size * (1.0 + heat * 0.25) * uScale * uDpr, 1.0, uMaxPoint);
  vSize = gl_PointSize;
  vec3 col = temp(heat);
  vCol = vec4(col * alpha, alpha * (1.0 - heat * 0.35));
}`;

const FRAG = `
precision mediump float;
varying vec4 vCol;
varying float vSquare;
varying vec2 vRot;
varying float vSize;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  // Pixels: a square turned to follow the ring (sprites are always axis-aligned); everything else: a soft dot.
  vec2 q = mat2(vRot.x, -vRot.y, vRot.y, vRot.x) * c;
  float edge = 1.2 / max(vSize, 1.0);
  float a = vSquare > 0.5 ? 1.0 - smoothstep(0.3535 - edge, 0.3535, max(abs(q.x), abs(q.y))) : 1.0 - smoothstep(0.1, 0.25, dot(c, c));
  if (a <= 0.0) discard;
  gl_FragColor = vCol * a;
}`;

/** Per-particle constants. Ring units: the 64-unit viewBox, centered, y down. */
function build(density: number) {
  const home: number[] = [];
  const info: number[] = [];
  const scat: number[] = [];
  const ang: number[] = [];
  const rnd = mulberry(7);
  const add = (x: number, y: number, g: number, ord: number, sx = 0, sy = 0, rot = 0) => {
    home.push(x, y);
    ang.push(rot);
    info.push(g, ord, rnd(), rnd());
    scat.push(sx, sy);
  };
  const { c, px, stroke, rings, core } = RING;

  // Human arcs: uniform over the half-annulus, ordered top → bottom (the direction the SVG draws).
  rings.forEach(({ r }, ri) => {
    const n = Math.round(Math.PI * r * stroke * 13 * density);
    for (let i = 0; i < n; i++) {
      const ord = rnd();
      const a = (Math.PI * 3) / 2 - ord * Math.PI;
      const rr = r + (rnd() - 0.5) * stroke * 0.92;
      add(Math.cos(a) * rr, Math.sin(a) * rr, ri, ord);
    }
  });

  // Machine pixels: a regular grid inside each square, rotated with it.
  const total = rings.reduce((s, r) => s + r.n, 0);
  const grid = density > 1.4 ? 6 : 5;
  let k = 0;
  rings.forEach(({ r, n }) => {
    pixels(r, n).forEach(({ x, y, deg }) => {
      const a = (deg * Math.PI) / 180;
      const h = mulberry(k * 31 + 5);
      const sx = 16 + h() * 44;
      const sy = (h() - 0.5) * 64;
      for (let gx = 0; gx < grid; gx++)
        for (let gy = 0; gy < grid; gy++) {
          const u = ((gx + 0.5) / grid - 0.5) * px;
          const v = ((gy + 0.5) / grid - 0.5) * px;
          const lx = x - c + u * Math.cos(a) - v * Math.sin(a);
          const ly = y - c + u * Math.sin(a) + v * Math.cos(a);
          add(lx, ly, 2, k / (total - 1), sx + (rnd() - 0.5) * 10, sy + (rnd() - 0.5) * 10, a);
        }
      add(x - c, y - c, 5, k / (total - 1), sx, sy, a);
      k++;
    });
  });

  // Core.
  const nc = Math.round(Math.PI * core * core * 8 * density);
  for (let i = 0; i < nc; i++) {
    const a = rnd() * Math.PI * 2;
    const rr = Math.sqrt(rnd()) * core;
    add(Math.cos(a) * rr, Math.sin(a) * rr, 3, 0);
  }

  // Sparks.
  for (let i = 0; i < 160; i++) add((rnd() - 0.5) * 4, (rnd() - 0.5) * 3, 4, 0);

  return { home: new Float32Array(home), info: new Float32Array(info), scat: new Float32Array(scat), ang: new Float32Array(ang), count: home.length / 2 };
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

/** Starts the particle ring on `canvas`, following `ring`'s on-screen box. Returns a stop function. */
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
    console.warn('[crucible] particle ring disabled:', e);
    onFail?.();
    return () => {};
  }
  gl.useProgram(prog);

  const touch = matchMedia('(hover: none)').matches;
  const data = build(touch ? 1 : 1.6);
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
  attr('aAng', data.ang, 1);
  const u = Object.fromEntries(
    ['uCenter', 'uView', 'uScale', 'uDpr', 'uTime', 'uLife', 'uSm', 'uSh', 'uCore', 'uFlare', 'uBloom', 'uMouse', 'uMaxPoint'].map((n) => [n, gl.getUniformLocation(prog, n)]),
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

  let raf = 0;
  let visible = true;
  let t0 = 0;
  let last = 0;
  let slow = 0;
  let ready = false;
  let lost = false;
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
    raf = requestAnimationFrame(frame);
    if (!t0) t0 = now;
    const dt = last ? now - last : 16;
    last = now;
    // Long frames for ~1.5 s in a row: step quality down.
    slow = dt > 24 ? slow + dt : Math.max(0, slow - dt * 0.5);
    if (slow > 1500 && now - t0 > 2500) {
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

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(u.uCenter, cx, cy);
    gl.uniform2f(u.uView, w, h);
    gl.uniform1f(u.uScale, scale);
    gl.uniform1f(u.uDpr, dpr);
    gl.uniform1f(u.uTime, now / 1000);
    gl.uniform1f(u.uLife, (now - t0) / 1000);
    gl.uniform1f(u.uSm, state.sm);
    gl.uniform1f(u.uSh, state.sh);
    gl.uniform1f(u.uCore, Math.min(1, state.core));
    gl.uniform1f(u.uFlare, state.flare);
    gl.uniform3f(u.uMouse, (mouse.x - (r.left + r.width / 2)) / scale, (mouse.y - (r.top + r.height / 2)) / scale, mouse.s);
    gl.uniform1f(u.uBloom, 1);
    gl.drawArrays(gl.POINTS, 0, data.count);
    gl.uniform1f(u.uBloom, 0);
    gl.drawArrays(gl.POINTS, 0, data.count);

    if (!ready) {
      ready = true;
      onReady?.();
    }
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
    document.removeEventListener('visibilitychange', onVis);
    canvas.removeEventListener('webglcontextlost', onLost);
  }
  loop();
  return stop;
}
