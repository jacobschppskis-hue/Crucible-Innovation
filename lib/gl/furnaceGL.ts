// The footer furnace: molten iron under the wordmark. Own copy of the original molten surface shader (the Thesis one
// moved on to flames), transparent where there is no heat so the page liquid shows through; premultiplied alpha.
// It is hottest at the floor and fades out toward the top. Reduced resolution, drawn on the one clock (`onFrame`) only
// while on screen; it fades in over the CSS band so the footer is composed before and after it arrives.
import { clock, clockHeld, onFrame, renderer } from '@/lib/liquid/loop';

type Options = { canvas: HTMLCanvasElement; heat: () => number; onReady?: () => void; onFail?: () => void };

const VERT = `attribute vec2 aPos; void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

// highp: with mediump, Apple GPUs (Safari) compute in half floats, where the hashed noise collapses and the metal loses
// its veins; every engine should draw the same furnace.
const FRAG = `
precision highp float;
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
  vec2 p = vec2(uv.x * asp, uv.y) * 2.4;
  float t = uTime * (0.03 + uK * 0.08);
  // the molten surface: a rolling line near the base, lifted by slow waves and a little noise
  float top = 0.30 + 0.035 * sin(uv.x * asp * 5.0 + uTime * 0.7) + 0.025 * sin(uv.x * asp * 11.0 - uTime * 1.1);
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t));
  float n = fbm(p + 2.6 * q + vec2(t * 1.3, 0.0));
  top += (n - 0.5) * 0.09;
  vec2 d = gl_FragCoord.xy - uMouse.xy;
  top += uMouse.z * 0.05 * exp(-dot(d, d) / (0.03 * uRes.y * uRes.y));
  float below = smoothstep(top, top - 0.02, uv.y);             // 1 inside the metal
  float depth = clamp((top - uv.y) / top, 0.0, 1.0);
  // inside: bright crust of orange-yellow veined with darker red, hotter toward the surface
  float veins = pow(1.0 - abs(n * 2.0 - 1.0), 3.0);
  float tm = clamp(0.5 + 0.35 * veins + 0.25 * (1.0 - depth) - 0.18 * depth * (1.0 - n), 0.0, 0.96) * (0.7 + 0.3 * uK + 0.2 * uK);
  vec3 metal = blackbody(tm);
  // the lip of the surface burns brightest
  float lip = exp(-pow((uv.y - top) / 0.03, 2.0));
  metal = mix(metal, vec3(1.0, 0.82, 0.5), lip * 0.8);
  // above: heat glowing up behind the letters, flickering slowly, fading out well before the top
  float rise = uv.y - top;
  float halo = exp(-max(rise, 0.0) * 3.4) * smoothstep(0.95, 0.35, uv.y);
  halo *= 0.8 + 0.4 * fbm(vec2(uv.x * asp * 3.0, uv.y * 2.0 - t * 3.0));
  vec3 glow = blackbody(0.5 + 0.2 * halo);
  float aGlow = (1.0 - below) * halo * (0.42 + 0.3 * uK);
  float aMetal = below * (0.92 + 0.08 * veins);
  float a = clamp(aMetal + aGlow + lip * 0.5 * (1.0 - below), 0.0, 1.0);
  vec3 col = (metal * aMetal + glow * aGlow + vec3(1.0, 0.8, 0.45) * lip * 0.5 * (1.0 - below));
  gl_FragColor = vec4(min(col, vec3(a)), a);
}`;

// The furnace fades in over this long (clock seconds) from its first frame, over the CSS band (globals.css --gl).
const FADE_IN = 0.8;

export function startFurnaceGL({ canvas, heat, onReady, onFail }: Options): () => void {
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
  const box = canvas.parentElement!;

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

  const mouse = { x: 0, y: 0, s: 0, moved: -1 };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * canvas.width;
    mouse.y = (1 - (e.clientY - r.top) / r.height) * canvas.height;
    mouse.moved = clock.t;
  };
  addEventListener('pointermove', onMove, { passive: true });

  // On the one clock, as renderer 'furnace' (paused off screen). t0: the surface's time starts small (mediump floats),
  // already rolling; fade: its opacity over the CSS band, on the clock (a CSS transition runs on wall-clock time).
  const rd = renderer('furnace', 'main');
  rd.setPaused(true);
  let off: (() => void) | undefined, stopped = false, slow = 0, run = 0, t0 = -1, fade = 0, ready = false;
  const frame = (T: number, dt: number) => {
    if (stopped || document.hidden) return;
    if (t0 < 0) t0 = T - 20;
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
    mouse.s += ((mouse.moved >= 0 && T - mouse.moved < 0.9 ? 1 : 0) - mouse.s) * Math.min(1, dt / 0.3);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, T - t0);
    gl.uniform1f(uK, heat());
    gl.uniform3f(uMouse, mouse.x, mouse.y, mouse.s);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (fade < 1) {
      fade = Math.min(1, fade + dt / FADE_IN);
      box.style.setProperty('--gl', (fade * fade * (3 - 2 * fade)).toFixed(3));
    }
    rd.done(T);
    if (!ready) {
      ready = true;
      onReady?.();
    }
  };
  // Starts a little before it scrolls into view, so on a normal scroll it is already burning when it arrives.
  const io = new IntersectionObserver(
    ([e]) => {
      if (stopped) return;
      if (e.isIntersecting && !off) off = onFrame(frame);
      else if (!e.isIntersecting && off) {
        off();
        off = undefined;
      }
      rd.setPaused(!off);
    },
    { rootMargin: '25% 0px 25% 0px' },
  );
  io.observe(canvas);
  function stop() {
    stopped = true;
    off?.();
    off = undefined;
    rd.off();
    io.disconnect();
    ro.disconnect();
    removeEventListener('pointermove', onMove);
    box.style.removeProperty('--gl');
  }
  return stop;
}
