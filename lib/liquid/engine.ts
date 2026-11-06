// The liquid's GL engine: compiles the shader, owns the quality steps and the frame-time adaptation. Used by the
// worker (liquidWorker.ts, the normal path) and by the main-thread fallback (render.ts). Nothing here touches the DOM.
//
// Software GL (SwiftShader / llvmpipe, i.e. no GPU: CI, PageSpeed, some VMs) starts at a low step (small render scale,
// capped fps, fewer packets) so the liquid still shows without starving the machine. `?liquid=full` (our own
// screenshot checks) skips that and pins the top step: no software start, no adaptation.

import { MAX_SOURCES, packSources } from './field';
import { fragment, VERT } from './shader';

type Ctx = WebGLRenderingContext | WebGL2RenderingContext;
type Step = [scale: number, packets: number, fps: number]; // fps 0 = every frame

export function isSoftwareGL(gl: Ctx) {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    return /swiftshader|llvmpipe|software|basic render/i.test(name);
  } catch {
    return false;
  }
}

export type Engine = {
  setView(w: number, h: number, dpr: number): void;
  /** Draw if due (fps caps); returns true if it drew. */
  draw(t: number, scroll: number): boolean;
  /** The main-thread watchdog says long tasks keep coming: step quality down. */
  stepDown(t: number): void;
  resume(): void;
  stats: { q: number; live: number; soft: boolean };
};

export function createEngine(gl: Ctx, canvas: { width: number; height: number }, o: { full: boolean }): Engine | null {
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

  const soft = !o.full && isSoftwareGL(gl);
  let steps: Step[] = [];
  let q = 0;
  let qMin = 0;
  const build = (dpr: number) => {
    const all: Step[] = [
      [dpr, cap, 0],
      [Math.max(1, dpr * 0.75), cap, 0],
      [1, Math.min(cap, 32), 0],
      [0.75, Math.min(cap, 24), 0],
      [0.55, Math.min(cap, 16), 0],
      [0.4, Math.min(cap, 12), 24],
      [0.3, Math.min(cap, 8), 15],
    ];
    const prev = steps[q];
    steps = all.filter(([s], i) => i === 0 || s < all[i - 1][0]);
    qMin = soft ? steps.findIndex((s) => s[2] > 0) : 0;
    q = prev ? Math.min(steps.length - 1, Math.max(qMin, q)) : qMin;
  };

  let vw = 1;
  let vh = 1;
  let w = 0;
  let h = 0;
  const resize = () => {
    const sc = steps[q][0];
    const pw = Math.max(1, Math.round(vw * sc));
    const ph = Math.max(1, Math.round(vh * sc));
    if (pw !== w || ph !== h) {
      w = pw;
      h = ph;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  };

  let slow = 0;
  let fast = 0;
  let cool = 0;
  let noUpUntil = 0;
  let lastDown = -99;
  let last = 0;
  const stats = { q: 0, live: 0, soft };

  const down = (t: number) => {
    q++;
    slow = 0;
    cool = 1.5;
    if (t - lastDown < 8) noUpUntil = t + 40;
    lastDown = t;
    resize();
  };

  return {
    stats,
    setView(nw, nh, dpr) {
      vw = Math.max(1, nw);
      vh = Math.max(1, nh);
      build(Math.min(dpr || 1, 2));
      resize();
    },
    resume() {
      last = 0;
    },
    stepDown(t) {
      if (o.full || q >= steps.length - 1) return;
      noUpUntil = t + 40;
      down(t);
    },
    draw(t, scroll) {
      const tgt = steps[q][2] ? 1 / steps[q][2] : 0;
      if (last && t - last < tgt * 0.85) return false;
      const dt = last ? Math.min(0.25, t - last) : 1 / 60;
      last = t;
      if (!o.full) {
        // Adapt: a run of slow frames steps down; a long calm run steps back up (never above the start step).
        cool -= dt;
        const slowAt = tgt ? tgt * 1.6 : 0.024;
        const fastAt = tgt ? tgt * 1.15 : 0.0185;
        if (dt > slowAt) {
          slow++;
          fast = 0;
        } else {
          slow = Math.max(0, slow - 0.25);
          fast = dt < fastAt ? fast + 1 : 0;
        }
        if (slow > 24 && q < steps.length - 1 && cool <= 0) down(t);
        else if (fast > 360 && q > qMin && cool <= 0 && t > noUpUntil) {
          q--;
          fast = 0;
          cool = 3;
          resize();
        }
      }
      const n = packSources(t, steps[q][1], A, B);
      gl.uniform2f(uView, vw, vh);
      gl.uniform1f(uScale, w / vw);
      gl.uniform1f(uScroll, scroll);
      gl.uniform1f(uTime, t);
      gl.uniform1i(uN, n);
      gl.uniform4fv(uA, A);
      gl.uniform4fv(uB, B);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      stats.q = q;
      stats.live = n;
      return true;
    },
  };
}
