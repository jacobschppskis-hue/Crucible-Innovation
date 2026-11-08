// Rich tier for the home Thesis: a surface of iron that heats with scroll (293 K → 1811 K).
//
// One fullscreen fragment shader: domain-warped noise for the metal, coloured on a blackbody ramp. Cold, only the
// cracks glow dull red; as it heats the whole surface brightens and starts to flow. It is hottest at the floor and
// fades out toward the top so the type stays clean; the cursor adds heat where it is. (This is the Nov 2 build's fire,
// restored exactly: same shader, same resolution, same speeds.)
// Soft noise doesn't need full resolution: it renders small and the browser scales it up. Drawn on the one clock
// (`onFrame`) only while on screen; it steps its resolution down on slow frames (never while a harness drives the
// clock) and never gives up. Software GL starts at the last step; `?liquid=full` keeps the first.
// The canvas is transparent where the metal is cold: the page's liquid shows through (see the end of the shader).
import { clock, clockHeld, onFrame, renderer } from '@/lib/liquid/loop';

type Options = { canvas: HTMLCanvasElement; heat: () => number; onReady?: () => void; onFail?: () => void };

const VERT = `attribute vec2 aPos; void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

// The page ground (--ground, #0d0d0b) the original drew over. Its result over that ground is reproduced exactly, but
// the part of the cold metal that only darkened the ground is dropped, so cold areas are transparent.
const GROUND = [13 / 255, 13 / 255, 11 / 255].map((v) => v.toFixed(4)).join(', ');

// highp: Apple GPUs run mediump as half floats (the domain warp loses its detail there).
const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime, uK;
uniform vec3 uMouse; // px from bottom-left, strength
const vec3 GROUND = vec3(${GROUND});

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
  vec2 p = vec2(uv.x * uRes.x / uRes.y, uv.y) * 2.6;
  float t = uTime * (0.015 + uK * 0.07);
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 3.2 * q + vec2(1.7, 9.2) + t * 1.4), fbm(p + 3.2 * q + vec2(8.3, 2.8)));
  float n = fbm(p + 2.8 * r);
  float cracks = pow(1.0 - abs(n * 2.0 - 1.0), 7.0);           // thin bright seams in cold metal
  float field = mix(cracks * 0.85, n * 1.15, smoothstep(0.35, 1.0, uK)); // melting: the whole surface takes over
  float floorHeat = smoothstep(1.0, 0.0, uv.y);
  float temp = field * (0.05 + uK * 0.95) * (0.3 + floorHeat * 0.85);
  vec2 d = gl_FragCoord.xy - uMouse.xy;
  temp += uMouse.z * 0.35 * exp(-dot(d, d) / (0.02 * uRes.y * uRes.y)) * (0.4 + uK);
  temp = clamp(temp, 0.0, 0.9); // never white-hot across the board: the type sits on top of this
  vec3 col = blackbody(temp);
  float fade = smoothstep(0.6, 0.0, uv.y);                      // metal pools in the lower part; the type stays clear
  float a = fade * (0.45 + 0.55 * smoothstep(0.0, 0.25, temp));
  // The original: (col * a, a) over the ground, which gives col * a + GROUND * (1 - a). Same result with less cover:
  // (C, A) gives C + GROUND * (1 - A), so C = a * (col - GROUND * (1 - w)) for A = a * w. Where it is cold (w 0) the
  // cover is 0 and only the light the metal adds is drawn (none where it is darker than the ground): transparent over
  // the liquid. Where it glows the metal covers what is behind it, as before.
  float w = smoothstep(0.02, 0.3, temp);
  gl_FragColor = vec4(max(a * (col - GROUND * (1.0 - w)), 0.0), a * w);
}`;

// Software GL (no GPU): the renderer's name, as lib/liquid/engine.ts and lib/gl3d/core.ts tell it.
function softwareGL(gl: WebGLRenderingContext) {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return /swiftshader|llvmpipe|software|basic render/i.test(String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER)));
  } catch {
    return false;
  }
}

// The fire fades in over this long (clock seconds) from its first frame, over the CSS furnace (globals.css --gl).
const FADE_IN = 0.8;

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
  const scene = canvas.parentElement!;

  // Half resolution, stepping down on slow frames. Software GL (SwiftShader, llvmpipe: CI, PageSpeed, VMs) starts at
  // the last step, as the liquid and the 3D do; `?liquid=full` (screenshots) keeps the first.
  const scales = [0.5, 0.35, 0.25];
  let q = softwareGL(gl) && !/[?&]liquid=full\b/.test(location.search) ? scales.length - 1 : 0;
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

  const rd = renderer('thesis', 'main');
  rd.setPaused(true);
  // fade: the fire's opacity over the CSS furnace, on the clock (a CSS transition would run on wall-clock time).
  let off: (() => void) | undefined, stopped = false, slow = 0, run = 0, ready = false, fade = 0;
  const frame = (T: number, dt: number) => {
    if (stopped || document.hidden) return;
    run += dt;
    if (!clockHeld()) {
      slow = dt > 0.026 ? slow + dt : Math.max(0, slow - dt * 0.5);
      if (slow > 1.5 && run > 2) {
        slow = 0;
        if (q + 1 < scales.length) {
          q++;
          resize();
        }
      }
    }
    const k = Math.min(1, Math.max(0, heat()));
    mouse.s += ((mouse.moved >= 0 && T - mouse.moved < 0.9 ? 1 : 0) - mouse.s) * Math.min(1, dt / 0.3);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, T);
    gl.uniform1f(uK, k);
    gl.uniform3f(uMouse, mouse.x, mouse.y, mouse.s);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (canvas.style.visibility) canvas.style.visibility = '';
    if (fade < 1) {
      fade = Math.min(1, fade + dt / FADE_IN);
      scene.style.setProperty('--gl', (fade * fade * (3 - 2 * fade)).toFixed(3));
    }
    canvas.dataset.t = T.toFixed(3); // clock time of the last frame drawn here (screenshot checks wait on it)
    canvas.dataset.k = k.toFixed(4); // the heat it was drawn at
    rd.done(T);
    if (!ready) {
      ready = true;
      onReady?.();
    }
  };
  const io = new IntersectionObserver(([e]) => {
    if (stopped) return;
    if (e.isIntersecting && !off) off = onFrame(frame);
    else if (!e.isIntersecting && off) {
      off();
      off = undefined;
      // Leave nothing stale behind: hidden (and cleared) until its first frame back on screen is drawn at the heat of
      // that moment. (A clear alone is not always presented while the canvas is off screen: WebKit showed the old one.)
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
