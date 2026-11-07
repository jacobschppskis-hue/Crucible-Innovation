// The spark simulation + WebGL drawing, DOM-free: runs in sparksWorker.ts (OffscreenCanvas) or, where that is missing, on the main thread (sparks.ts).
// Sparks thrown off the casting front (the Ember line that pours a concept site in).
//
// A few hundred CPU-simulated particles drawn by WebGL as short streaks with a hot head: born on the front line,
// thrown up and out, pulled down by gravity, cooling from white-hot to ember to nothing. The emission rate follows
// how fast the front is moving, so a quick scroll throws a shower and a still front just smoulders.

const VERT = `
attribute vec2 aPos;
attribute float aHeat;
uniform vec2 uView;
uniform float uSize;
varying float vHeat;
void main() {
  vHeat = aHeat;
  gl_Position = vec4(aPos / uView * 2.0 - 1.0, 0.0, 1.0);
  gl_Position.y = -gl_Position.y;
  gl_PointSize = uSize * (0.6 + aHeat * 0.8);
}`;

const FRAG = `
precision mediump float;
varying float vHeat;
uniform float uPoint;
void main() {
  float a = 1.0;
  if (uPoint > 0.5) {
    vec2 c = gl_PointCoord - 0.5;
    a = 1.0 - smoothstep(0.05, 0.25, dot(c, c));
  }
  vec3 ember = vec3(1.0, 0.357, 0.122), hot = vec3(1.0, 0.702, 0.278), white = vec3(1.0, 0.96, 0.9);
  vec3 col = vHeat > 0.6 ? mix(hot, white, (vHeat - 0.6) / 0.4) : mix(ember * 0.6, hot, vHeat / 0.6);
  float alpha = a * smoothstep(0.0, 0.25, vHeat);
  gl_FragColor = vec4(col * alpha, alpha);
}`;

const MAX = 700;

/** One casting front, in canvas CSS px: where it is, how wide, how visible, and how fast it is moving (px/s). */
export type Emitter = { x: number; y: number; w: number; op: number; speed: number };
export type SparkCore = { resize(w: number, h: number, dpr: number): void; frame(dt: number, ems: Emitter[], thin: number): boolean };

/** `null` if WebGL or the shaders are unavailable. */
export function createSparkCore(canvas: HTMLCanvasElement | OffscreenCanvas): SparkCore | null {
  const gl = (canvas as HTMLCanvasElement).getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true }) as WebGLRenderingContext | null;
  if (!gl) return null;
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
    console.warn('[crucible] sparks disabled:', e);
    return null;
  }
  gl.useProgram(prog);
  const uView = gl.getUniformLocation(prog, 'uView');
  const uSize = gl.getUniformLocation(prog, 'uSize');
  const uPoint = gl.getUniformLocation(prog, 'uPoint');
  const aPos = gl.getAttribLocation(prog, 'aPos');
  const aHeat = gl.getAttribLocation(prog, 'aHeat');
  const posBuf = gl.createBuffer();
  const heatBuf = gl.createBuffer();
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE); // additive: overlapping sparks bloom

  // Particle state (CSS px in canvas space).
  const x = new Float32Array(MAX), y = new Float32Array(MAX), vx = new Float32Array(MAX), vy = new Float32Array(MAX);
  const life = new Float32Array(MAX), age = new Float32Array(MAX);
  let count = 0;
  const lines = new Float32Array(MAX * 4);
  const lineHeat = new Float32Array(MAX * 2);
  const heads = new Float32Array(MAX * 2);
  const headHeat = new Float32Array(MAX);

  let w = 1, h = 1;
  const resize = (cw: number, ch: number, dpr: number) => {
    w = cw;
    h = ch;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    pxScale = dpr;
  };
  let pxScale = 1;

  const spawn = (px: number, py: number, kick: number) => {
    if (count >= MAX) return;
    const i = count++;
    x[i] = px;
    y[i] = py;
    vx[i] = (Math.random() - 0.5) * 240;
    vy[i] = -(60 + Math.random() * 220) * (0.6 + kick);
    life[i] = 0.5 + Math.random() * 0.9;
    age[i] = 0;
  };

  /** Advance dt seconds and draw. Returns whether anything is still alive. */
  const frame = (dt: number, ems: Emitter[], thin: number) => {
    for (const e of ems) {
      const rate = (6 + Math.min(e.speed, 1500) * 0.12) * e.op * thin; // sparks per second
      let n = rate * dt;
      while (n > 0) {
        if (Math.random() < n) {
          // bias toward the middle of the line, where it is hottest
          const t = 0.5 + (Math.random() + Math.random() + Math.random() - 1.5) / 3;
          spawn(e.x + t * e.w, e.y, Math.min(1, e.speed / 800));
        }
        n -= 1;
      }
    }
    // Simulate: gravity, a little drag; drop the dead by swapping in the last live one.
    for (let i = 0; i < count; i++) {
      age[i] += dt;
      if (age[i] >= life[i]) {
        count--;
        x[i] = x[count]; y[i] = y[count]; vx[i] = vx[count]; vy[i] = vy[count]; life[i] = life[count]; age[i] = age[count];
        i--;
        continue;
      }
      vy[i] += 520 * dt;
      vx[i] *= 1 - 0.8 * dt;
      x[i] += vx[i] * dt;
      y[i] += vy[i] * dt;
      const heat = 1 - age[i] / life[i];
      lines[i * 4] = x[i];
      lines[i * 4 + 1] = y[i];
      lines[i * 4 + 2] = x[i] - vx[i] * 0.035;
      lines[i * 4 + 3] = y[i] - vy[i] * 0.035;
      lineHeat[i * 2] = heat;
      lineHeat[i * 2 + 1] = heat * 0.3;
      heads[i * 2] = x[i];
      heads[i * 2 + 1] = y[i];
      headHeat[i] = heat;
    }

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (count) {
      gl.uniform2f(uView, w, h);
      gl.uniform1f(uSize, 4 * pxScale);
      const draw = (pos: Float32Array, heat: Float32Array, n: number, mode: number, point: number) => {
        gl.uniform1f(uPoint, point);
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
        gl.bufferData(gl.ARRAY_BUFFER, pos.subarray(0, n * 2), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, heatBuf);
        gl.bufferData(gl.ARRAY_BUFFER, heat.subarray(0, n), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(aHeat);
        gl.vertexAttribPointer(aHeat, 1, gl.FLOAT, false, 0, 0);
        gl.drawArrays(mode, 0, n);
      };
      draw(lines, lineHeat, count * 2, gl.LINES, 0);
      draw(heads, headHeat, count, gl.POINTS, 1);
    }
    return count > 0;
  };
  return { resize, frame };
}
