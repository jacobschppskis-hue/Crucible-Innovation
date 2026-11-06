// Paints the dark liquid: ONE fixed full-viewport WebGL canvas behind the page (z-index -1). Near-black body with a
// faint procedural texture that refracts a little as waves pass, and the wave crests as crisp, thin Ember contour
// lines (an iso-line of the height field, drawn with analytic distance so it stays 1-2 CSS px at any render scale).
// No bloom, no blur. The wave formula is the one in field.ts (`sample`), written out in GLSL.

import { bindInput, DECAY, DISP, K0, KDROP, MAX_SOURCES, packSources, SPEED, SPREAD, SWELL } from './field';
import { onFrame } from './loop';

const f = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));

function fragment(cap: number) {
  const swell = SWELL.map(([ang, len, spd, a, ph]) => {
    const kx = (Math.cos(ang) * 2 * Math.PI) / len;
    const ky = (Math.sin(ang) * 2 * Math.PI) / len;
    const w = ((2 * Math.PI) / len) * spd;
    return `{ float ar = ${kx}*p.x + ${ky}*p.y - ${w}*uTime + ${ph}; h += ${a}*sin(ar); g += ${a}*cos(ar)*vec2(${kx}, ${ky}); }`;
  }).join('\n  ');
  return /* glsl */ `
precision highp float;
uniform vec2 uView;
uniform float uScale;
uniform float uScroll;
uniform float uTime;
uniform int uN;
uniform vec4 uA[${cap}];
uniform vec4 uB[${cap}];

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), u = fract(p);
  u = u * u * (3.0 - 2.0 * u);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uView.y * uScale - gl_FragCoord.y) / uScale;
  p.y += uScroll;
  float h = 0.0;
  vec2 g = vec2(0.0);
  for (int i = 0; i < ${cap}; i++) {
    if (i >= uN) break;
    vec4 a = uA[i];
    float size = uB[i].x;
    float age = a.z;
    vec2 dv = p - a.xy;
    float r = length(dv);
    float sig = size * (1.0 + ${f(DISP)} * age);
    float R = ${f(SPEED)} * age;
    float d = r - R;
    if (abs(d) > 3.0 * sig) continue;
    float k = ${K0} / size / (1.0 + ${f(KDROP)} * age);
    float A = a.w * exp(-${f(DECAY)} * age) / sqrt((1.0 + R / ${f(SPREAD)}) * (1.0 + ${f(DISP)} * age));
    float e = exp(-0.5 * d * d / (sig * sig));
    float c = cos(k * d);
    float s = sin(k * d);
    h += A * e * c;
    g += dv / max(r, 0.001) * (A * e * (-d / (sig * sig) * c - k * s));
  }
  ${swell}

  // Body: near-black with a faint texture, seen through the surface (the slope bends where we look).
  vec2 q = (p + g * 320.0) / 90.0;
  float tx = vnoise(q) * 0.6 + vnoise(q * 2.3 + 7.0) * 0.4;
  vec3 col = vec3(0.051, 0.051, 0.043) + vec3(0.9, 0.78, 0.62) * 0.034 * smoothstep(0.3, 0.9, tx);

  // Crests and troughs: thin Ember iso-lines of h. Brighter for stronger waves (higher levels only exist there).
  float gl = max(length(g), 0.00005);
  float px = 1.0 / uScale;
  float hw = 0.55;
  float line = 0.0;
  line += 0.1 * (1.0 - smoothstep(hw - 0.5 * px, hw + 0.5 * px, abs(h - 0.07) / gl));
  line += 0.45 * (1.0 - smoothstep(hw - 0.5 * px, hw + 0.5 * px, abs(h - 0.24) / gl));
  line += 1.0 * (1.0 - smoothstep(hw - 0.5 * px, hw + 0.5 * px, abs(h - 0.5) / gl));
  line += 0.3 * (1.0 - smoothstep(hw - 0.5 * px, hw + 0.5 * px, abs(h + 0.3) / gl));
  col += vec3(1.0, 0.357, 0.122) * min(line, 1.0) * 0.9;

  col += (hash(gl_FragCoord.xy + uTime) - 0.5) / 255.0; // dither: no banding in the dark
  gl_FragColor = vec4(col, 1.0);
}`;
}

const VERT = `attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }`;

/**
 * Start the liquid on `canvas`. Returns a stop function, or null if WebGL isn't available (the page stays plain dark).
 * Adaptive: watches frame time and steps render scale and packet count down (and back up) instead of stuttering.
 */
export function startLiquid(canvas: HTMLCanvasElement): (() => void) | null {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const maxVec = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) as number;
  const cap = Math.max(8, Math.min(MAX_SOURCES, Math.floor((maxVec - 10) / 2)));

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragment(cap)));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const u = (n: string) => gl.getUniformLocation(prog, n);
  const uView = u('uView');
  const uScale = u('uScale');
  const uScroll = u('uScroll');
  const uTime = u('uTime');
  const uN = u('uN');
  const uA = u('uA');
  const uB = u('uB');
  const A = new Float32Array(cap * 4);
  const B = new Float32Array(cap * 4);

  // Quality steps, best first: [render scale, packets]. A phone gets the top step, then drops only if it must.
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const steps: [number, number][] = [
    [dpr, cap],
    [Math.max(1, dpr * 0.75), cap],
    [1, Math.min(cap, 32)],
    [0.75, Math.min(cap, 24)],
    [0.55, Math.min(cap, 16)],
  ].filter(([s], i, all) => i === 0 || s < all[i - 1][0]) as [number, number][];
  let q = 0;
  let w = 0;
  let h = 0;
  const size = () => {
    const cw = Math.max(1, innerWidth);
    const ch = Math.max(1, innerHeight);
    const sc = steps[q][0];
    const pw = Math.round(cw * sc);
    const ph = Math.round(ch * sc);
    if (pw !== w || ph !== h) {
      w = pw;
      h = ph;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  };
  size();
  addEventListener('resize', size);

  const unbind = bindInput();
  canvas.dataset.on = '';
  let frames = 0;
  let slow = 0;
  let fast = 0;
  let cool = 0;
  let noUpUntil = 0;
  let lastDown = -99;

  const draw = (t: number, dt: number) => {
    // Adapt: a run of slow frames steps down; a long calm run steps back up (unless that just failed).
    cool -= dt;
    if (dt > 0.024) {
      slow++;
      fast = 0;
    } else {
      slow = Math.max(0, slow - 0.25);
      fast = dt < 0.0185 ? fast + 1 : 0;
    }
    if (slow > 24 && q < steps.length - 1 && cool <= 0) {
      q++;
      slow = 0;
      cool = 1.5;
      if (t - lastDown < 8) noUpUntil = t + 40;
      lastDown = t;
      size();
    } else if (fast > 360 && q > 0 && cool <= 0 && t > noUpUntil) {
      q--;
      fast = 0;
      cool = 3;
      size();
    }

    const n = packSources(t, steps[q][1], A, B);
    gl.uniform2f(uView, innerWidth, innerHeight);
    gl.uniform1f(uScale, w / Math.max(1, innerWidth));
    gl.uniform1f(uScroll, scrollY);
    gl.uniform1f(uTime, t);
    gl.uniform1i(uN, n);
    gl.uniform4fv(uA, A);
    gl.uniform4fv(uB, B);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (++frames % 3 === 0) {
      canvas.dataset.frames = String(frames);
      canvas.dataset.live = String(n);
      canvas.dataset.q = String(q);
    }
  };
  const off = onFrame(draw);

  const lost = (e: Event) => {
    e.preventDefault();
    off();
    canvas.style.display = 'none';
  };
  canvas.addEventListener('webglcontextlost', lost);

  return () => {
    off();
    unbind();
    removeEventListener('resize', size);
    canvas.removeEventListener('webglcontextlost', lost);
    delete canvas.dataset.on;
  };
}
