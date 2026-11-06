// Rich tier for the home Thesis: rising fluid flames that climb with the reading (293 K → 1811 K).
//
// One fullscreen fragment shader: domain-warped noise carried upward, coloured on a blackbody ramp. The canvas is
// transparent wherever there is no flame so the page liquid shows through. At 293 K only a low bed of dull embers;
// the reach grows with heat until the fire fills most of the viewport. Reduced resolution, only while on screen,
// and it steps its resolution down on slow frames.
import { DECAY, DISP, packSources, SPEED, SPREAD, SWELL } from '@/lib/liquid/field';
import { clock } from '@/lib/liquid/loop';

type Options = { canvas: HTMLCanvasElement; crest?: HTMLCanvasElement | null; heat: () => number; onReady?: () => void; onFail?: () => void };

const VERT = `attribute vec2 aPos; void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const CAP = 24; // wave sources the flame/crest shaders read (the liquid's newest ones)
const fl = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));
// The liquid's wave formula (lib/liquid/shader.ts, field.ts) in GLSL: same packets, same idle swell, same page coords.
const WAVES = `
uniform vec2 uOrg; // canvas top-left in page CSS px
uniform vec2 uCss; // canvas size in CSS px
uniform float uClock;
uniform int uN;
uniform vec4 uA[${CAP}];
uniform vec4 uB[${CAP}];
void waves(vec2 p, out float hp, out vec2 gp, out float hs, out vec2 gs) {
  float h = 0.0;
  vec2 g = vec2(0.0);
  for (int i = 0; i < ${CAP}; i++) {
    if (i >= uN) break;
    vec4 a = uA[i];
    float size = uB[i].x;
    float age = a.z;
    vec2 dv = p - a.xy;
    float r = length(dv);
    float sig = size * (1.0 + ${fl(DISP)} * age);
    float R = ${fl(SPEED)} * age;
    float d = r - R;
    if (abs(d) > 3.0 * sig) continue;
    float A = a.w * exp(-${fl(DECAY)} * age) / sqrt((1.0 + R / ${fl(SPREAD)}) * (1.0 + ${fl(DISP)} * age));
    float e = exp(-0.5 * d * d / (sig * sig));
    h += A * e;
    g += dv / max(r, 0.001) * (A * e * (-d / (sig * sig)));
  }
  gp = g;
  hp = h;
  h = 0.0;
  g = vec2(0.0);
  ${SWELL.map(([ang, len, spd, a, ph]) => {
    const kx = (Math.cos(ang) * 2 * Math.PI) / len;
    const ky = (Math.sin(ang) * 2 * Math.PI) / len;
    const w = ((2 * Math.PI) / len) * spd;
    return `{ float ar = ${kx}*p.x + ${ky}*p.y - ${w}*uClock + ${ph}; h += ${a}*sin(ar); g += ${a}*cos(ar)*vec2(${kx}, ${ky}); }`;
  }).join('\n  ')}
  hs = h;
  gs = g;
}
vec2 pagePos(vec2 uv) { return uOrg + vec2(uv.x, 1.0 - uv.y) * uCss; }
`;

// Crest lines: the liquid's own Ember iso-lines (same look, same field) drawn at full resolution over the flames,
// with a dark edge so they read on hot metal. Where there is no flame they land exactly on the liquid's own lines.
const CREST = `
precision highp float;
uniform float uScale;
${WAVES}
void main() {
  vec2 uv = gl_FragCoord.xy / (uCss * uScale);
  vec2 p = pagePos(uv);
  float hp, hs; vec2 gp, gs;
  waves(p, hp, gp, hs, gs);
  float px = 1.0 / uScale;
  float hw = 0.6;
  float gl = max(length(gp), 0.0004);
  float dA = abs(hp - 0.1) / gl, dB = abs(hp - 0.3) / gl;
  float line = 0.5 * (1.0 - smoothstep(hw - 0.5 * px, hw + 0.5 * px, dA)) + 1.0 * (1.0 - smoothstep(hw - 0.5 * px, hw + 0.5 * px, dB));
  float gsl = max(length(gs), 0.00002);
  float ds = abs(hs) / gsl;
  float sw = 0.16 * (1.0 - smoothstep(hw - 0.5 * px, hw + 0.5 * px, ds));
  float l = min(min(line, 1.0) * 0.95 + sw, 1.0);
  // dark edge hugging the line (stronger for the strong crests)
  float halo = 0.85 * (1.0 - smoothstep(hw, hw + 3.4 * px, dB)) + 0.5 * (1.0 - smoothstep(hw, hw + 2.8 * px, dA));
  halo = min(halo, 0.85) * (1.0 - l);
  vec3 ember = vec3(1.0, 0.46, 0.2); // Ember, a touch lifted so the core still reads on hot metal
  gl_FragColor = vec4(ember * l, min(1.0, l + halo));
}`;

const FRAG = `
precision highp float;
${WAVES}
uniform vec2 uRes;
uniform float uTime, uK;
uniform vec3 uMouse; // px from bottom-left, strength

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}
vec3 blackbody(float t) {
  vec3 c = mix(vec3(0.035, 0.03, 0.025), vec3(0.4, 0.04, 0.0), smoothstep(0.0, 0.35, t));
  c = mix(c, vec3(1.0, 0.357, 0.122), smoothstep(0.3, 0.62, t));
  c = mix(c, vec3(1.0, 0.702, 0.278), smoothstep(0.6, 0.85, t));
  return mix(c, vec3(1.0, 0.95, 0.86), smoothstep(0.88, 1.0, t));
}
void main() {
  vec2 uv0 = gl_FragCoord.xy / uRes;
  float asp = uRes.x / uRes.y;
  float k = uK;
  // refraction: the flames are seen through the liquid surface, so they bend along its slope
  float hp, hs; vec2 gp, gs;
  waves(pagePos(uv0), hp, gp, hs, gs);
  vec2 bend = (gp + gs) * 90.0 / uCss * vec2(1.0, -1.0);
  vec2 uv = uv0 + bend;
  float x = uv.x * asp, y = uv.y;
  float t = uTime * (0.4 + k * 0.8);
  // Tongue height: a low bed of embers at 293 K, most of the screen at 1811 K; it varies slowly across the width.
  float reach = 0.14 + 1.25 * k * (0.55 + 0.45 * k);
  // Sway grows with height; the flow is carried upward (sample coordinates move down).
  float sway = fbm(vec2(x * 1.4, y * 1.1 - t * 0.9)) - 0.5;
  float xs = x + sway * (0.15 + 0.9 * y);
  float lick = noise(vec2(xs * 2.3 + 3.0, t * 0.55)) * 0.6 + noise(vec2(xs * 5.0, t * 1.1 + 9.0)) * 0.4;
  float H = reach * (0.35 + 0.85 * lick);
  float yn = y / max(H, 0.02);
  // Vertical streaks (x stretched vs y) give tongues; finer scales break them up as they climb.
  float tg = fbm(vec2(xs * 3.2, y * 1.5 - t * 1.5));
  float fine = fbm(vec2(xs * 7.0 + 5.0, y * 4.0 - t * 2.8));
  float d = (1.0 - yn) * 1.0 + (tg - 0.5) * 1.3 - (fine - 0.5) * 0.8 * (0.3 + yn) - 0.1;
  float a = smoothstep(0.0, 0.2, d);
  // Internal structure: hot veins inside each tongue, cooler edges and tips, dim pockets in the base.
  float vein = fbm(vec2(xs * 4.5 + 2.0, y * 2.2 - t * 2.0));
  float temp = d * 0.55 + (vein - 0.5) * 1.3 + (tg - 0.5) * 0.4 + 0.12 + k * 0.08;
  temp = clamp(temp, 0.0, 1.0) * (0.6 + 0.4 * k);
  temp = min(temp, 0.72);
  a *= 0.4 + 0.6 * smoothstep(0.05, 0.4, temp + (fine - 0.5) * 0.5);
  vec3 col = blackbody(temp);
  vec2 dm = gl_FragCoord.xy - uMouse.xy;
  float m = uMouse.z * 0.3 * exp(-dot(dm, dm) / (0.02 * uRes.y * uRes.y));
  col += vec3(1.0, 0.45, 0.1) * m * a;
  // The type band is cooler and thinner so the copy stays legible over the fire.
  float band = smoothstep(0.18, 0.4, uv0.y) * smoothstep(0.78, 0.55, uv0.y);
  a = clamp(a * (0.5 + 0.5 * k), 0.0, 1.0) * (1.0 - 0.55 * band);
  col *= 1.0 - 0.3 * band;
  gl_FragColor = vec4(col * a, a);
}`;

type Pass = { gl: WebGLRenderingContext; u: (n: string) => WebGLUniformLocation | null };

function makePass(canvas: HTMLCanvasElement, frag: string, opts: WebGLContextAttributes): Pass | null {
  const gl = canvas.getContext('webgl', opts);
  if (!gl) return null;
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, frag));
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

export function startMolten({ canvas, crest, heat, onReady, onFail }: Options): () => void {
  let flame: Pass | null = null;
  let line: Pass | null = null;
  try {
    flame = makePass(canvas, FRAG, { alpha: true, premultipliedAlpha: true, antialias: false, depth: false });
    if (flame && crest) line = makePass(crest, CREST, { alpha: true, premultipliedAlpha: true, antialias: false, depth: false });
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
  const uTime = flame.u('uTime');
  const uK = flame.u('uK');
  const uMouse = flame.u('uMouse');
  const passes = [flame, ...(line ? [line] : [])].map((p) => ({
    p,
    org: p.u('uOrg'),
    css: p.u('uCss'),
    clk: p.u('uClock'),
    n: p.u('uN'),
    a: p.u('uA'),
    b: p.u('uB'),
    scale: p.u('uScale'),
  }));
  const A = new Float32Array(CAP * 4);
  const B = new Float32Array(CAP * 4);

  // Soft noise doesn't need full resolution: render small and let the browser scale it up. The crest lines are
  // one pixel wide, so they render at (nearly) full resolution and only step down when frames run slow.
  const scales = [0.5, 0.35, 0.25];
  const lineScales = [1, 0.75, 0.5];
  const sources = [CAP, 14, 8];
  let q = 0;
  const resize = () => {
    const d = Math.min(devicePixelRatio || 1, 2);
    const s = scales[q] * d;
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * s));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * s));
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (line && crest) {
      const c = lineScales[q] * Math.min(d, 1.5);
      crest.width = Math.max(1, Math.round(crest.clientWidth * c));
      crest.height = Math.max(1, Math.round(crest.clientHeight * c));
      line.gl.viewport(0, 0, crest.width, crest.height);
    }
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  const mouse = { x: 0, y: 0, s: 0, moved: 0 };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * canvas.width;
    mouse.y = (1 - (e.clientY - r.top) / r.height) * canvas.height;
    mouse.moved = performance.now();
  };
  addEventListener('pointermove', onMove, { passive: true });

  let raf = 0, visible = false, stopped = false, last = 0, slow = 0, t0 = 0, ready = false;
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) loop();
  });
  io.observe(canvas);
  const frame = (now: number) => {
    raf = 0;
    if (stopped || !visible || document.hidden) return;
    raf = requestAnimationFrame(frame);
    if (!t0) t0 = now;
    const dt = last ? now - last : 16;
    last = now;
    slow = dt > 26 ? slow + dt : Math.max(0, slow - dt * 0.5);
    if (slow > 1500 && now - t0 > 2000) {
      slow = 0;
      // Slow: render at a lower resolution and read fewer wave sources (down to the last step, where it stays).
      if (q + 1 < scales.length) {
        q++;
        resize();
      }
    }
    mouse.s += ((now - mouse.moved < 900 ? 1 : 0) - mouse.s) * Math.min(1, dt / 300);
    const r = canvas.getBoundingClientRect();
    const n = packSources(clock.t, sources[q], A, B);
    for (const { p, org, css, clk, n: un, a, b, scale } of passes) {
      p.gl.uniform2f(org, r.left + scrollX, r.top + scrollY);
      p.gl.uniform2f(css, r.width, r.height);
      p.gl.uniform1f(clk, clock.t);
      p.gl.uniform1i(un, n);
      p.gl.uniform4fv(a, A);
      p.gl.uniform4fv(b, B);
      if (scale) p.gl.uniform1f(scale, (crest?.width ?? 1) / r.width);
    }
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, now / 1000);
    gl.uniform1f(uK, heat());
    gl.uniform3f(uMouse, mouse.x, mouse.y, mouse.s);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    line?.gl.drawArrays(line.gl.TRIANGLES, 0, 3);
    if (!ready) {
      ready = true;
      onReady?.();
    }
  };
  function loop() {
    if (!raf && !stopped) raf = requestAnimationFrame(frame);
  }
  function stop() {
    stopped = true;
    cancelAnimationFrame(raf);
    io.disconnect();
    ro.disconnect();
    removeEventListener('pointermove', onMove);
    document.removeEventListener('visibilitychange', onVis);
  }
  const onVis = () => !document.hidden && loop();
  document.addEventListener('visibilitychange', onVis);
  return stop;
}
