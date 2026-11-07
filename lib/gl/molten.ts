// Rich tier for the home Thesis: a fire that comes up with the reading (293 K → 1811 K).
//
// One fullscreen fragment shader: noise carried upward, coloured on a blackbody ramp. The canvas is transparent wherever
// there is no flame so the page liquid shows through. Two inputs, kept apart on purpose:
//   - time only carries the flames upward, at one calm pace (RISE) whatever the heat, so the fire never speeds up;
//   - heat only shapes it: how wide the burning bed is, how tall the tongues reach, how bright and how hot they look.
// At 293 K there is next to nothing (a faint dull-red bed in the middle); at 1811 K the whole floor burns, about half
// the screen high. Heat is followed with a rate-limited ease, so a scroll jump still brings the fire up gradually.
// Drawn on the one clock (`onFrame`), at reduced resolution, only while on screen; it steps its resolution down on slow
// frames (never while a harness drives the clock).
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

// Upward flow in viewport heights per second. One constant for every heat: the tongues climb at the same pace at
// 293 K and at 1811 K. The finer layers run a little faster (turbulence quickens with height), also constant.
const RISE = 0.17;

const FRAG = `
precision highp float;
${WAVES}
uniform vec2 uRes;
uniform float uTime, uK; // flow time (s), heat 0..1
uniform vec3 uMouse; // px from bottom-left, strength
const float RISE = ${RISE.toFixed(3)};

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
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
  vec3 sw = swell(canvasPos(uv0));
  vec2 bend = sw.yz * 40.0 / uCss * vec2(1.0, -1.0); // only a slight shift of the flames
  vec2 uv = uv0 + bend;
  float x = uv.x * asp, y = uv.y;
  float t = uTime;
  float up = t * RISE; // how far the flow has climbed: never depends on the heat
  // The bed: how much of the floor burns. A narrow patch in the middle when cool, the whole width when hot; its edge
  // wanders slowly so it never reads as a stencil.
  float cx = abs(uv.x - 0.5) * 2.0;
  float edge = noise(vec2(uv.x * 2.5 + 7.0, t * 0.07)) - 0.5;
  float hw = mix(0.28, 1.55, k);
  float bed = 1.0 - smoothstep(hw - 0.55, hw + 0.05, cx + edge * 0.35);
  // Tongue height: grows with heat (and toward the middle of the bed). Slow licks vary it across the width; the power
  // sharpens them into separate tongues with low valleys between.
  float sway = fbm(vec2(x * 1.3, (y - up) * 1.0)) - 0.5;
  float xs = x + sway * (0.05 + 0.35 * y);
  float lick = noise(vec2(xs * 3.4 + 3.0, t * 0.32)) * 0.65 + noise(vec2(xs * 7.5, t * 0.55 + 9.0)) * 0.35;
  lick = pow(lick, 1.5);
  float reach = mix(0.05, 0.5, k) * (0.45 + 0.55 * bed);
  float H = reach * (0.35 + 1.1 * lick);
  float yn = y / max(H, 0.015);
  // Turbulence carried upward; it eats into the flame more toward the tips, which break into wisps.
  float tg = fbm(vec2(xs * 5.0, (y - up) * 2.2));
  float fine = fbm(vec2(xs * 10.0 + 5.0, (y - up * 1.15) * 3.8));
  float d = (1.0 - yn) + (tg - 0.5) * (0.5 + 0.9 * yn) - (fine - 0.5) * 0.5 * (0.3 + yn) - 0.05;
  float a = smoothstep(0.0, 0.16, d) * bed;
  // Colour: hottest low in the bed, cooling to dull red at the tips. Streaks of brighter and darker gas rise through
  // the body (at the same constant pace), so it reads as separate burning tongues rather than a lit wall.
  float body = clamp(1.0 - yn, 0.0, 1.0);
  float streak = fbm(vec2(xs * 7.0 + 2.0, (y - up * 1.08) * 3.2));
  float temp = 0.12 + 0.6 * body + (streak - 0.5) * 0.8 + (tg - 0.5) * 0.25;
  temp = min(clamp(temp, 0.0, 1.0) * mix(0.55, 1.0, k), 0.8);
  a *= 0.3 + 0.7 * smoothstep(0.22, 0.62, streak + 0.3 * body);
  vec3 col = blackbody(temp);
  vec2 dm = gl_FragCoord.xy - uMouse.xy;
  float m = uMouse.z * 0.18 * exp(-dot(dm, dm) / (0.02 * uRes.y * uRes.y));
  col += vec3(1.0, 0.45, 0.1) * m * a;
  // The type band is cooler and thinner so the copy stays legible over the fire.
  float band = smoothstep(0.18, 0.4, uv0.y) * smoothstep(0.78, 0.55, uv0.y);
  a = clamp(a * mix(0.12, 0.78, k), 0.0, 1.0) * (1.0 - 0.55 * band);
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

// Heat easing: the flames follow the scroll's heat with this time constant and never faster than HEAT_RATE per
// second, so even a jump (End key, anchor, a landing scroll progress) brings the fire up over most of a second.
const HEAT_LAG = 0.3;
const HEAT_RATE = 1.1;

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
  const uTime = flame.u('uTime');
  const uK = flame.u('uK');
  const uMouse = flame.u('uMouse');
  const uCss = flame.u('uCss');
  const uSwell = flame.u('uSwell');
  const ph = new Float32Array(4);

  // Soft noise doesn't need full resolution: render small and let the browser scale it up.
  const scales = [0.5, 0.35, 0.25];
  let q = 0;
  const resize = () => {
    const d = Math.min(devicePixelRatio || 1, 2);
    const s = scales[q] * d;
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
  // t0: flow time starts at 0 (small shader coordinates); kf: the eased heat (-1 = not drawn yet).
  let off: (() => void) | undefined, stopped = false, slow = 0, run = 0, t0 = -1, kf = -1, ready = false;
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
    gl.uniform1f(uTime, T - t0);
    gl.uniform1f(uK, kf);
    gl.uniform3f(uMouse, mouse.x, mouse.y, mouse.s);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (canvas.style.visibility) canvas.style.visibility = '';
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
  }
  return stop;
}
