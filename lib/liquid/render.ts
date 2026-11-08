// The liquid, main-thread side: ONE fixed full-viewport canvas behind the page (z-index -1) that paints the dark liquid.
// Every frame of the one clock (loop.ts): the input becomes impulses, the wave grid steps (sim.ts), and the frame
// {t, scroll, heights} goes to the renderer. Normally that is a Web Worker drawing on an OffscreenCanvas (WebGL2), so
// a slow or software GL never blocks the page; where the worker can't get WebGL2 (Playwright WebKit, older Safari) the
// same engine draws here, in the same frame. The worker draws exactly the frames it is sent and acknowledges each; the
// page never queues a second frame while one is out (the newest waits and goes as soon as the last is done).
//
// Hooks: window.__liquid (stats, sources, sample, near) for tests and the motion harness; the canvas carries data-on,
// data-t (time of the last frame drawn), data-frames, data-live (input events that made waves in the last 3 s),
// data-q (quality step), data-path (worker | main).

import { createEngine, type Engine, type GridMeta } from './engine';
import { activity, attachSim, liveCount as liveFloats, setFloatSink, addSource, samplePx, sampleGrid } from './field';
import { createInput, TUNE } from './input';
import { WAKE } from './wake';
import { clock, onFrame, renderer, clockHeld } from './loop';
import { createSim } from './sim';

/** A floating thing's ripple of v1 amplitude `amp` (0.12 a heading, 0.22 an ingot, 0.55 the pour landing) becomes a drop
 *  of this strength per unit: the landing is about half a tap, an ingot's ripple a faint ring. */
const FLOAT_DROP = 50;

const full = () => /[?&]liquid=full\b/.test(location.search);

type Path = 'worker' | 'main';

export function startLiquid(canvas: HTMLCanvasElement): (() => void) | null {
  if (typeof WebGL2RenderingContext === 'undefined') return null;
  const sim = createSim();
  const cellFor = () => 8;
  // sized in the first frame (reading the scroll position here could force a style and layout pass into the task that
  // loads this module: one long task at start-up)
  let sized = false;
  const input = createInput((x, y, amp, size) => addSource(x, y, amp, size, { kind: 'ring' }));
  attachSim(sim);
  // ripples shed by floating things (the pour landing, an ingot, a heading rocked hard): small ringing drops, so they
  // spread as clean rings, never as a smooth blob
  setFloatSink((x, y, amp) => input.drop(x, y, amp * FLOAT_DROP));

  let path: Path = 'main';
  let stopRender: (() => void) | null = null;
  let drawnT = -1;
  let frames = 0;
  let q = 0;
  let soft = false;
  const reg = renderer('liquid', 'worker');

  // ---- the frame: input -> grid -> renderer ----
  let meta: GridMeta = { cols: 0, rows: 0, x0: 0, y0: 0, cell: 8, on: false };
  let send: ((t: number, sy: number, dt: number) => void) | null = null;
  let begin: (() => void) | null = null;
  const offFrame = onFrame((t, dt) => {
    if (document.hidden) return;
    const sy = scrollY;
    if (!sized) {
      sized = true;
      sim.resize(innerWidth, innerHeight, cellFor(), sy);
    }
    const stamps = input.stamps(dt, sim.cell);
    activity.last = input.lastUser();
    sim.follow(sy);
    // the drops step in the grid, then the wake is evaluated into the same display state
    const sx = scrollX;
    sim.advance(dt, stamps, (out, cols, rows, x0, y0, cell) => input.wake.addTo(out, cols, rows, x0, y0, cell, t, sx, sy, input.heads()), input.wake.active(t));
    meta = { cols: sim.cols, rows: sim.rows, x0: sim.x0, y0: sim.y0, cell: sim.cell, on: !sim.quiet };
    begin?.();
    send?.(t, sy, dt);
    if (frames % 4 === 0) {
      canvas.dataset.live = String(input.liveCount(t) + liveFloats(t));
    }
  });

  const onResize = () => {
    sim.resize(innerWidth, innerHeight, cellFor(), scrollY);
    view?.();
  };
  let view: (() => void) | null = null;
  addEventListener('resize', onResize);

  const drew = (t: number, n: number, qq: number) => {
    drawnT = t;
    frames = n;
    q = qq;
    reg.done(t);
    canvas.dataset.t = t.toFixed(3);
    if (n % 3 === 0 || n < 3) {
      canvas.dataset.frames = String(n);
      canvas.dataset.q = String(qq);
    }
  };

  // ---- worker path ----
  function startWorker(cv: HTMLCanvasElement): boolean {
    if (typeof Worker === 'undefined' || typeof cv.transferControlToOffscreen !== 'function') return false;
    let worker: Worker;
    let off: OffscreenCanvas;
    try {
      worker = new Worker(new URL('./liquidWorker.ts', import.meta.url));
      off = cv.transferControlToOffscreen();
    } catch {
      return false;
    }
    path = 'worker';
    reg.path = 'worker';
    cv.dataset.path = 'worker';
    const pool: Float32Array[] = [];
    let busy = false;
    let pending: { t: number; sy: number } | null = null;
    let late = 0;
    let dead = false;
    const post = (t: number, sy: number) => {
      let heights: Float32Array | null = null;
      if (meta.on) {
        const N = meta.cols * meta.rows;
        heights = pool.pop() ?? null;
        if (!heights || heights.length !== N) heights = new Float32Array(N);
        heights.set(sim.out.subarray(0, N));
      }
      const tr: Transferable[] = heights ? [heights.buffer] : [];
      worker.postMessage({ type: 'frame', t, sy, late, hold: clockHeld(), meta, heights }, tr);
      late = 0;
      busy = true;
    };
    // While nothing moves (a quiet grid, no scrolling) only the slow swell changes: 30 frames a second
    // are plenty and halve the cost. A harness that steps time gets every frame.
    let lastPost = -1;
    let lastSy = NaN;
    send = (t, sy) => {
      if (!meta.on && sy === lastSy && !clockHeld() && t - lastPost < 1 / 40 && t >= lastPost) return;
      if (busy) {
        pending = { t, sy };
        late++;
        return;
      }
      lastPost = t;
      lastSy = sy;
      post(t, sy);
    };
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m.type === 'drawn') {
        busy = false;
        if (m.heights && pool.length < 3) pool.push(m.heights);
        drew(m.t, m.frames, m.q);
        if (pending) {
          const p = pending;
          pending = null;
          post(p.t, p.sy);
        }
      } else if (m.type === 'ok') {
        soft = !!m.soft;
        cv.dataset.soft = String(soft);
      } else if (m.type === 'ready') cv.dataset.on = '';
      else if (m.type === 'fail') fail();
    };
    worker.onerror = () => fail();
    function fail() {
      if (dead) return;
      dead = true;
      stop();
      // A canvas handed to a worker can't get a context again: swap in a fresh one for the main-thread path.
      const fresh = cv.cloneNode(false) as HTMLCanvasElement;
      delete fresh.dataset.on;
      // React's node stays in the tree (spent, hidden, unclassed): on a client-side navigation React inserts the next
      // page's nodes before it, and a node it can't find there throws NotFoundError and drops the page (WebKit: no
      // worker WebGL2, so this path runs on every Safari visit).
      cv.after(fresh);
      cv.removeAttribute('class');
      cv.style.display = 'none';
      canvas = fresh;
      if (!startMain(fresh)) {
        fresh.style.display = 'none';
        reg.setPaused(true);
      }
    }
    view = () => worker.postMessage({ type: 'view', w: innerWidth, h: innerHeight, dpr: devicePixelRatio || 1 });
    const onVis = () => reg.setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    worker.postMessage({ type: 'init', canvas: off, full: full(), w: innerWidth, h: innerHeight, dpr: devicePixelRatio || 1 }, [off]);
    function stop() {
      send = null;
      document.removeEventListener('visibilitychange', onVis);
      worker.terminate();
    }
    stopRender = stop;
    return true;
  }

  // ---- main-thread path ----
  function startMain(cv: HTMLCanvasElement): boolean {
    let gl: WebGL2RenderingContext | null = null;
    try {
      gl = cv.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power' });
    } catch {
      gl = null;
    }
    if (!gl) return false;
    const engine: Engine | null = createEngine(gl, cv, { full: full() });
    if (!engine) return false;
    path = 'main';
    reg.path = 'main';
    cv.dataset.path = 'main';
    soft = engine.stats.soft;
    cv.dataset.soft = String(soft);
    view = () => engine.setView(innerWidth, innerHeight, devicePixelRatio || 1);
    view();
    let n = 0;
    let lastOn = false;
    send = (t, sy, dt) => {
      // heights straight from the grid (no copy); unchanged quiet grids are not uploaded again
      const on = meta.on;
      engine.upload(meta, on || lastOn ? sim.out : null);
      lastOn = on;
      if (engine.draw(t, sy, dt > 0.034 ? 1 : 0, clockHeld())) n++;
      drew(t, n, engine.stats.q);
      if (n === 1) cv.dataset.on = '';
    };
    const lost = (e: Event) => {
      e.preventDefault();
      send = null;
      cv.style.display = 'none';
      reg.setPaused(true);
    };
    cv.addEventListener('webglcontextlost', lost);
    stopRender = () => {
      send = null;
      cv.removeEventListener('webglcontextlost', lost);
    };
    return true;
  }

  // The renderer starts in the first frame: handing the canvas to a worker makes the browser resolve its style and
  // layout, which then belongs to that frame instead of the task that loaded this module. Without OffscreenCanvas the
  // main-thread engine starts at once.
  const canWorker = typeof Worker !== 'undefined' && typeof canvas.transferControlToOffscreen === 'function';
  begin = () => {
    begin = null;
    if (!startWorker(canvas) && !startMain(canvas)) {
      canvas.style.display = 'none';
      reg.setPaused(true);
    }
  };
  if (!canWorker) {
    begin();
    if (!send) {
      offFrame();
      input.unbind();
      attachSim(null);
      setFloatSink(null);
      reg.off();
      removeEventListener('resize', onResize);
      return null;
    }
  }

  // ---- hooks for tests and the harness ----
  const hooks = {
    v: 2,
    stats(at?: { x: number; y: number; r?: number }) {
      return {
        t: clock.t,
        drawnT,
        live: input.liveCount() + liveFloats(),
        q,
        soft,
        path,
        frames,
        cell: sim.cell,
        cols: sim.cols,
        rows: sim.rows,
        quiet: sim.quiet,
        peak: sim.peak,
        contexts: 1,
        near: at ? sim.near(at.x, at.y, at.r ?? 150) : null,
      };
    },
    sources: (since?: number) => input.sources(since),
    sample: (x: number, docY: number, t?: number) => ({ ...samplePx(x, docY, t) }),
    grid: (x: number, docY: number) => ({ ...sampleGrid(x, docY) }),
    near: (x: number, docY: number, r = 150) => sim.near(x, docY, r),
    /** the wake's and the input's tunables (live: a harness can try values without a rebuild) */
    tune: { WAKE, TUNE },
    wakeCount: () => input.wake.count,
  };
  (window as unknown as { __liquid?: typeof hooks }).__liquid = hooks;

  return () => {
    offFrame();
    stopRender?.();
    input.unbind();
    attachSim(null);
    setFloatSink(null);
    reg.off();
    removeEventListener('resize', onResize);
    delete canvas.dataset.on;
    const w = window as unknown as { __liquid?: unknown };
    if (w.__liquid === hooks) delete w.__liquid;
  };
}
