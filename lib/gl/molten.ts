// Rich tier for the home Thesis: rising fluid flames that climb with the reading (293 K → 1811 K).
//
// One fullscreen fragment shader: domain-warped noise carried upward, coloured on a blackbody ramp. The canvas is
// transparent wherever there is no flame so the page liquid shows through. At 293 K only a low bed of dull embers;
// the reach grows with heat until the fire fills most of the viewport. Reduced resolution, only while on screen,
// and it steps its resolution down on slow frames.
import { dropToLight } from '@/lib/tier';

type Options = { canvas: HTMLCanvasElement; heat: () => number; onReady?: () => void; onFail?: () => void };

const VERT = `attribute vec2 aPos; void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `
precision mediump float;
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
  vec2 uv = gl_FragCoord.xy / uRes;
  float asp = uRes.x / uRes.y;
  float k = uK;
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
  float band = smoothstep(0.18, 0.4, uv.y) * smoothstep(0.78, 0.55, uv.y);
  a = clamp(a * (0.5 + 0.5 * k), 0.0, 1.0) * (1.0 - 0.55 * band);
  col *= 1.0 - 0.3 * band;
  gl_FragColor = vec4(col * a, a);
}`;

export function startMolten({ canvas, heat, onReady, onFail }: Options): () => void {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false });
  if (!gl) {
    onFail?.();
    return () => {};
  }
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
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
  } catch (e) {
    console.warn('[crucible] molten surface disabled:', e);
    onFail?.();
    return () => {};
  }
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(prog, 'uRes');
  const uTime = gl.getUniformLocation(prog, 'uTime');
  const uK = gl.getUniformLocation(prog, 'uK');
  const uMouse = gl.getUniformLocation(prog, 'uMouse');

  // Soft noise doesn't need full resolution: render small and let the browser scale it up.
  const scales = [0.5, 0.35, 0.25];
  let q = 0;
  const resize = () => {
    const s = scales[q] * Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * s));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * s));
    gl.viewport(0, 0, canvas.width, canvas.height);
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
      // Slow: render at a lower resolution (down to the last step, where it stays).
      if (q + 1 < scales.length) {
        q++;
        resize();
      }
    }
    mouse.s += ((now - mouse.moved < 900 ? 1 : 0) - mouse.s) * Math.min(1, dt / 300);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, now / 1000);
    gl.uniform1f(uK, heat());
    gl.uniform3f(uMouse, mouse.x, mouse.y, mouse.s);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!ready) {
      ready = true;
      onReady?.();
    }
  };
  function loop() {
    if (!raf && !stopped) raf = requestAnimationFrame(frame);
  }
  function fail() {
    stop();
    dropToLight();
    onFail?.();
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
