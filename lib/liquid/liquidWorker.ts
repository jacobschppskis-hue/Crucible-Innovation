// The liquid's renderer, off the main thread: owns the OffscreenCanvas (WebGL2) and draws exactly what the main frame
// posts (time, scroll, the grid's heights). It keeps no clock and runs no animation loop of its own: one main frame,
// one message, one draw, one 'drawn' back (with the heights buffer, so the main thread can reuse it). See render.ts.

import { createEngine, type Engine, type GridMeta } from './engine';

type Msg =
  | { type: 'init'; canvas: OffscreenCanvas; full: boolean; w: number; h: number; dpr: number }
  | { type: 'view'; w: number; h: number; dpr: number }
  | { type: 'frame'; t: number; sy: number; late: number; hold: boolean; meta: GridMeta; heights: Float32Array | null; mask: Uint8Array | null };

const ctx = self as unknown as {
  postMessage(m: unknown, transfer?: Transferable[]): void;
  onmessage: ((e: { data: Msg }) => void) | null;
};

let engine: Engine | null = null;
let ready = false;
let frames = 0;
let lastT = -1; // the last frame drawn (time, scroll): redrawn at once after a resize, so the canvas is never blank
let lastSy = 0;

ctx.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'init') {
    let gl: WebGL2RenderingContext | null = null;
    try {
      gl = m.canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power', desynchronized: false }) as WebGL2RenderingContext | null;
    } catch {
      gl = null;
    }
    engine = gl ? createEngine(gl, m.canvas, { full: m.full }) : null;
    if (!engine) {
      ctx.postMessage({ type: 'fail' });
      return;
    }
    engine.setView(m.w, m.h, m.dpr);
    ctx.postMessage({ type: 'ok', soft: engine.stats.soft });
  } else if (m.type === 'view') {
    if (!engine) return;
    engine.setView(m.w, m.h, m.dpr);
    if (lastT >= 0) engine.draw(lastT, lastSy, 0, true);
  }
  else if (m.type === 'frame') {
    if (!engine) return;
    engine.upload(m.meta, m.heights, m.mask);
    const drew = engine.draw(m.t, m.sy, m.late, m.hold);
    if (drew) {
      frames++;
      lastT = m.t;
      lastSy = m.sy;
    }
    const back: Transferable[] = m.heights ? [m.heights.buffer] : [];
    // Acknowledge after this task: the frame is committed to the page's canvas by then.
    const reply = { type: 'drawn', t: m.t, drew, frames, q: engine.stats.q, scale: engine.stats.scale, heights: m.heights };
    setTimeout(() => ctx.postMessage(reply, back), 0);
    if (drew && !ready) {
      ready = true;
      ctx.postMessage({ type: 'ready' });
    }
  }
};
