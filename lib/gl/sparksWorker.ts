// Sparks off the main thread: creating a WebGL context and compiling its shaders is a synchronous call into the GPU
// process, which stalls the page for most of a second where that process is busy (software GL); here it only stalls
// this worker. The main thread (sparks.ts) posts where the casting fronts are; this draws on its own clock.
import { createSparkCore, type Emitter, type SparkCore } from './sparksCore';

type Msg = { type: 'init'; canvas: OffscreenCanvas; w: number; h: number; dpr: number } | { type: 'size'; w: number; h: number; dpr: number } | { type: 'em'; ems: Emitter[] };
const ctx = self as unknown as { postMessage(m: unknown): void; onmessage: ((e: { data: Msg }) => void) | null; requestAnimationFrame?: (cb: (t: number) => void) => number };

let core: SparkCore | null = null;
let ems: Emitter[] = [];
let running = false, last = 0, slow = 0;

const frame = (now: number) => {
  running = false;
  if (!core) return;
  const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
  last = now;
  slow = dt > 0.024 ? slow + dt : Math.max(0, slow - dt);
  // Slow (long frames for ~2 s): fewer sparks, rather than none.
  const alive = core.frame(dt, ems, slow > 2 ? 0.35 : 1);
  if (alive || ems.length) kick();
  else last = 0;
};
function kick() {
  if (running) return;
  running = true;
  if (ctx.requestAnimationFrame) ctx.requestAnimationFrame(frame);
  else setTimeout(() => frame(performance.now()), 16);
}

ctx.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'init') {
    core = createSparkCore(m.canvas);
    if (!core) return ctx.postMessage({ type: 'fail' });
    core.resize(m.w, m.h, m.dpr);
    ctx.postMessage({ type: 'ready' });
  } else if (m.type === 'size') core?.resize(m.w, m.h, m.dpr);
  else if (m.type === 'em') {
    ems = m.ems;
    if (core && (ems.length || running)) kick();
  }
};
