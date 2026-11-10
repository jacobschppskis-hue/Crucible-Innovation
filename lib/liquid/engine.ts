// The liquid's GL engine (WebGL2): compiles the shader, keeps the grid's height texture, owns the quality steps. Used by
// the worker (liquidWorker.ts, the normal path) and by the main-thread fallback (render.ts). Nothing here touches the
// DOM, and nothing here keeps time: each draw is for the time the main frame says.
//
// Quality: a step is [render scale (x CSS px), frames per second cap]. A GPU starts at the top (scale = devicePixelRatio,
// capped at 2). Software GL (SwiftShader / llvmpipe: CI, PageSpeed) starts lower: a smaller canvas, still smooth (the
// glints are antialiased lines at any scale, never beads). Steps go down only when the renderer has kept the page
// waiting for a while, and come back up after a few calm seconds. `full` (?liquid=full, screenshots) pins the top step.

import { fragment, VERT } from './shader';
import { swellPhases } from './swell';

type Step = [scale: number, fps: number];

export function isSoftwareGL(gl: WebGL2RenderingContext) {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    return /swiftshader|llvmpipe|software|basic render/i.test(name);
  } catch {
    return false;
  }
}

export type GridMeta = { cols: number; rows: number; x0: number; y0: number; cell: number; on: boolean };

export type Engine = {
  setView(w: number, h: number, dpr: number): void;
  /** New heights (cols x rows, px), or null to keep the last ones. */
  upload(meta: GridMeta, heights: Float32Array | null): void;
  /** Draw the frame for time t (s) at scroll sy (page px). `late` = main frames that had to wait for the previous one;
   *  `hold` = a harness is stepping time (no adaptation). Returns false if the fps cap skipped it. */
  draw(t: number, sy: number, late: number, hold?: boolean): boolean;
  stats: { q: number; soft: boolean; scale: number };
};

export function createEngine(gl: WebGL2RenderingContext, canvas: { width: number; height: number }, o: { full: boolean }): Engine | null {
  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragment()));
  gl.bindAttribLocation(prog, 0, 'a');
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const u = (n: string) => gl.getUniformLocation(prog, n);
  const uView = u('uView');
  const uScale = u('uScale');
  const uOrg = u('uOrg');
  const uCell = u('uCell');
  const uSize = u('uSize');
  const uOn = u('uOn');
  const uSeed = u('uSeed');
  const uSwell = u('uSwell');
  const uSwellB = u('uSwellB');
  gl.uniform1i(u('uH'), 0);

  const tex = (unit: number) => {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  const tH = tex(0);
  let tw = 0;
  let th = 0;
  const meta: GridMeta = { cols: 0, rows: 0, x0: 0, y0: 0, cell: 8, on: false };
  const ph = new Float32Array(8);

  const soft = !o.full && isSoftwareGL(gl);
  let steps: Step[] = [];
  let q = 0;
  let qMin = 0;
  const build = (dpr: number) => {
    const all: Step[] = [
      [dpr, 0],
      [Math.max(1, dpr * 0.75), 0],
      [1, 0],
      [0.75, 0],
      [0.6, 0],
      [0.5, 30],
      [0.4, 24],
    ];
    const prev = steps[q];
    // a real GPU never goes below one canvas px per CSS px and never caps the frame rate: below that the glints are
    // magnified texels (a phone's liquid looked blocky at the 0.4-0.6 steps); only software GL needs the low steps
    steps = all.filter(([s], i) => (i === 0 || s < all[i - 1][0]) && (soft || s >= 1));
    // software GL: start where it still keeps up (measured: SwiftShader, 4 cores)
    qMin = soft ? Math.max(0, steps.findIndex(([s]) => s <= 0.5)) : 0;
    q = prev ? Math.min(steps.length - 1, Math.max(0, q)) : qMin;
  };

  let vw = 1;
  let vh = 1;
  let w = 0;
  let h = 0;
  const resize = () => {
    const sc = steps[q][0];
    const pw = Math.max(1, Math.round(vw * sc));
    const ph2 = Math.max(1, Math.round(vh * sc));
    if (pw !== w || ph2 !== h) {
      w = pw;
      h = ph2;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  };

  // Adaptation: count main frames that had to wait for us (late) against frames posted. Step down only when the page
  // has been kept waiting for over a second; step back up after a calm spell. Hysteresis: a step up that has to be
  // undone within 10 s doubles the calm needed before the next try (4 s, 8 s ... 30 s), so quality never oscillates.
  // Nothing adapts in the first 2.5 s (start-up work is not the steady state) or while a harness steps time (`hold`).
  let win: [number, number][] = []; // [t, late]
  let calmSince = -1;
  let lastDraw = 0;
  let upWait = 4;
  let lastUp = -99;
  let lastChange = 0;
  let first = -1;
  const stats = { q: 0, soft, scale: 1 };

  const adapt = (t: number, late: number) => {
    if (o.full) return;
    if (first < 0) first = t;
    if (t - first < 2.5) return;
    win.push([t, late]);
    while (win.length && win[0][0] < t - 1.5) win.shift();
    let posted = 0;
    let lateSum = 0;
    for (const [, l] of win) {
      posted++;
      lateSum += l;
    }
    const ratio = lateSum / Math.max(1, posted + lateSum);
    if (posted >= 12 && ratio > 0.34 && q < steps.length - 1 && t - lastChange > 1.5) {
      if (t - lastUp < 10) upWait = Math.min(30, upWait * 2); // we just came up from here: wait longer next time
      q++;
      lastChange = t;
      calmSince = -1;
      win = [];
      resize();
      return;
    }
    if (late) calmSince = -1;
    else if (calmSince < 0) calmSince = t;
    if (q > qMin && calmSince >= 0 && t - calmSince > upWait && t - lastChange > upWait) {
      q--;
      lastChange = lastUp = t;
      calmSince = -1;
      win = [];
      resize();
    }
  };

  return {
    stats,
    setView(nw, nh, dpr) {
      vw = Math.max(1, nw);
      vh = Math.max(1, nh);
      build(Math.min(dpr || 1, 2));
      resize();
    },
    upload(m, heights) {
      const grow = m.cols !== tw || m.rows !== th;
      Object.assign(meta, m);
      if (grow) {
        tw = m.cols;
        th = m.rows;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tH);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, tw, th, 0, gl.RED, gl.FLOAT, heights && heights.length >= tw * th ? heights : new Float32Array(tw * th));
        return;
      }
      if (heights) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tH);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, tw, th, gl.RED, gl.FLOAT, heights);
      }
    },
    draw(t, sy, late, hold) {
      if (!hold) adapt(t, late);
      const cap = steps[q][1];
      if (cap && lastDraw && t > lastDraw && t - lastDraw < (1 / cap) * 0.85) return false; // (the same t again = a redraw)
      lastDraw = t;
      gl.uniform2f(uView, vw, vh);
      gl.uniform1f(uScale, w / vw);
      gl.uniform2f(uOrg, meta.x0 + meta.cell / 2, meta.y0 + meta.cell / 2 - sy);
      gl.uniform1f(uCell, meta.cell);
      gl.uniform2i(uSize, Math.max(1, tw), Math.max(1, th));
      gl.uniform1f(uOn, meta.on && tw > 0 ? 1 : 0);
      gl.uniform1f(uSeed, (t * 60) % 97);
      swellPhases(0, sy, t, ph);
      gl.uniform4fv(uSwell, ph.subarray(0, 4));
      gl.uniform4fv(uSwellB, ph.subarray(4, 8));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (o.full) gl.finish(); // screenshot mode: the frame is really done before it is acknowledged
      stats.q = q;
      stats.scale = steps[q][0];
      return true;
    },
  };
}
