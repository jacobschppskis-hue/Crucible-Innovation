// Rich tier for the home Thesis: a fire that comes up with the reading (293 K → 1811 K).
//
// One fragment shader on a canvas that covers only the bottom of the scene (the fire never climbs higher), transparent
// wherever there is no flame so the page liquid shows through, around the tongues and between them. Two inputs, kept
// apart on purpose:
//   - time only carries the flames upward, at one calm pace (RISE) whatever the heat, so the fire never speeds up;
//   - heat only shapes it: how wide the burning bed is, how tall the tongues reach, how bright and how hot they look.
// Nothing glows below ~800 K (the Draper point); at 1811 K a bed of separate tongues burns along the floor, about a
// sixth of the screen high, dark red at the tips and orange in the cores. Every tongue has a crisp edge at screen
// resolution (a threshold of a smooth field, antialiased over about a pixel), so it reads as flame, not as a blurred
// texture. Heat is followed with a rate-limited ease, so a scroll jump still brings the fire up gradually.
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

// Upward flow in viewport heights per second. One constant for every heat: the tongues climb at the same pace at
// 800 K and at 1811 K.
const RISE = 0.17;

// The canvas covers this share of the scene's height, from the floor up (globals.css `.thesis-gl`).
export const FLAME_SPAN = 0.3;

// Units: P = canvas px / uVh, so heights are fractions of the scene (viewport) height and x is in the same unit.
const FRAG = `
precision highp float;
${WAVES}
uniform vec2 uRes; // canvas size in device px
uniform float uVh; // the scene's height in canvas px
uniform float uTime, uK; // flow time (s), heat 0..1
uniform vec3 uMouse; // canvas px from bottom-left, strength
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
  for (int i = 0; i < 3; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v / 0.875;
}
vec3 blackbody(float t) {
  vec3 c = mix(vec3(0.035, 0.03, 0.025), vec3(0.4, 0.04, 0.0), smoothstep(0.0, 0.35, t));
  c = mix(c, vec3(1.0, 0.357, 0.122), smoothstep(0.3, 0.62, t));
  c = mix(c, vec3(1.0, 0.702, 0.278), smoothstep(0.6, 0.85, t));
  return mix(c, vec3(1.0, 0.95, 0.86), smoothstep(0.88, 1.0, t));
}
// One row of tongues, one per slot along the floor (jittered), each with its own height that breathes slowly: widest a
// little above the base, tapering to a thin point, and frayed toward the tip by the rising turbulence tb. Returns
// the row's light (premultiplied): a crisp edge about a device pixel wide, hotter and denser toward the core and base.
vec4 tongues(float xs, float y, float slot, float seed, float lo, float hi, float tb, float gas, float k, float Hmax, float hw, float wv, float t) {
  float fx = xs / slot;
  float ci = floor(fx);
  float dd = -1.0, yt = 1.0, wd = 1.0;
  for (int j = -1; j <= 1; j++) {
    float c = ci + float(j);
    float r1 = hash(vec2(c, seed)), r2 = hash(vec2(c, seed + 4.6)), r3 = hash(vec2(c, seed + 8.2));
    float xc = c + 0.5 + (r1 - 0.5) * 0.6;
    // tongues toward the ends of the bed are shorter
    float bc = 1.0 - smoothstep(hw - 0.4, hw, abs(xc * slot / wv - 0.5) * 2.0);
    float hc = Hmax * mix(lo, hi, r3) * (0.7 + 0.6 * noise(vec2(c * 1.7 + seed, t * (0.22 + 0.16 * r2)))) * bc;
    float yn = y / max(hc, 0.002);
    float w0 = 0.4 + 0.25 * r2;
    float hwd = w0 * pow(max(1.0 - yn, 0.0), 1.15) * (1.0 + 0.9 * yn);
    float dj = (hwd - abs(fx - xc)) * slot - max(yn - 1.0, 0.0) * hc;
    if (dj > dd) { dd = dj; yt = yn; wd = w0 * slot; }
  }
  float d = dd + (tb - 0.5) * wd * (0.1 + 1.3 * clamp(yt, 0.0, 1.2)) - 0.0015;
  float w = fwidth(d);
  w = (w > 0.0 && w < 0.02) ? w * 0.7 : 0.02;
  float inside = smoothstep(-w, w, d);
  float core = clamp(d / (0.75 * wd), 0.0, 1.0);
  float base = 1.0 - clamp(yt, 0.0, 1.0);
  float temp = mix(0.3, 0.45, k) + (0.08 + 0.13 * k) * core * sqrt(base) + 0.07 * base * base + (gas - 0.5) * 0.08;
  float a = inside * (0.34 + 0.56 * core) * (0.5 + 0.5 * base) * (0.9 + 0.2 * gas);
  return vec4(blackbody(clamp(temp, 0.0, 0.72)) * a, a);
}
void main() {
  float k = uK;
  // Heat sets how tall the tongues may reach and how much they glow: nothing below ~800 K, a sixth of the scene high at
  // 1811 K.
  float glow = smoothstep(0.2, 0.62, k);
  float Hmax = 0.17 * smoothstep(0.17, 1.0, k);
  vec2 uv0 = gl_FragCoord.xy / uRes;
  // refraction: seen through the liquid, the flames shift a few px along the swell's slope
  vec3 sw = swell(canvasPos(uv0));
  vec2 P = (gl_FragCoord.xy + sw.yz * vec2(1.0, -1.0) * 90.0 * uRes / uCss) / uVh;
  float y = P.y;
  // Above the tallest possible tip: nothing to draw.
  if (y > Hmax * 1.6 + 0.004) { gl_FragColor = vec4(0.0); return; }
  float t = uTime;
  float up = t * RISE; // how far the flow has climbed: never depends on the heat
  // The bed: how much of the floor burns. A patch in the middle when it first glows, nearly the whole width when hot;
  // its ends wander slowly so they never read as a stencil.
  float wv = uRes.x / uVh;
  float cx = abs(P.x / wv - 0.5) * 2.0;
  float hw = mix(0.2, 1.08, smoothstep(0.2, 1.0, k));
  float bed = 1.0 - smoothstep(hw - 0.35, hw, cx + (noise(vec2(P.x * 2.0 + 7.0, t * 0.05)) - 0.5) * 0.3);
  // Sway: a lean that travels up the tongues at the flow's pace (an S-curve in the tall ones), more toward the tips.
  float sway = noise(vec2(P.x * 6.0, (y - up) * 7.0 + 3.0)) - 0.5;
  float xs = P.x + sway * (0.004 + 0.36 * y);
  // Turbulence carried upward at the same pace frays the tongues toward their tips, which break off into wisps.
  float tb = fbm(vec2(xs * 34.0, (y - up) * 11.0));
  // Brighter and darker gas rising through the tongues, at the same pace.
  float gas = noise(vec2(xs * 26.0 + 5.0, (y - up) * 16.0));
  // Two rows of tongues, their light adding up where they cross: tall ones behind, short ones licking in front.
  // Neighbours merge low down and part higher up, so the liquid shows between them.
  vec4 back = tongues(xs, y, 0.05, 3.1, 0.5, 1.0, tb, gas, k, Hmax, hw, wv, t);
  vec4 front = tongues(xs + 0.017, y, 0.034, 11.7, 0.2, 0.55, 1.0 - tb, 1.0 - gas, k, Hmax, hw, wv, t + 40.0);
  vec4 f = back * 0.85 + front;
  f.a = min(1.0, f.a);
  vec2 dm = gl_FragCoord.xy - uMouse.xy;
  f.rgb *= 1.0 + uMouse.z * 0.25 * exp(-dot(dm, dm) / (0.02 * uVh * uVh));
  // The floor: the tongues rise out of the dark rather than from a lit line, so the scene's lower edge never shows.
  f *= glow * bed * smoothstep(0.0, 0.014, y);
  gl_FragColor = vec4(min(f.rgb, vec3(1.0)), f.a);
}`;

type Pass = { gl: WebGLRenderingContext; u: (n: string) => WebGLUniformLocation | null };

function makePass(canvas: HTMLCanvasElement, frag: string, opts: WebGLContextAttributes): Pass | null {
  const gl = canvas.getContext('webgl', opts);
  if (!gl) return null;
  // fwidth() for the crisp edges (supported everywhere WebGL is; without it the edge falls back to a soft one).
  const deriv = !!gl.getExtension('OES_standard_derivatives');
  const src = deriv ? `#extension GL_OES_standard_derivatives : enable\n${frag}` : frag.replace('float w = fwidth(d);', 'float w = 0.08;');
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
// The flames fade in over this long (clock seconds) from their first frame, over the CSS furnace (globals.css --fg).
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

  // Full resolution (the edges are drawn at the pixel), stepping down only on slow frames.
  const scales = [1, 0.75, 0.5];
  let q = 0;
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
