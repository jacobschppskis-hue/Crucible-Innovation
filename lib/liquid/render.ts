// Paints the dark liquid: ONE fixed full-viewport canvas behind the page (z-index -1). Near-black body with a faint
// procedural texture that refracts a little as waves pass, and the wave crests as crisp, thin Ember contour lines.
// The shader is shader.ts, the GL engine (quality steps, adaptation) engine.ts.
//
// Normally the canvas is handed to a Web Worker (OffscreenCanvas, WebGL2; liquidWorker.ts) so a slow or software GL
// never blocks the main thread: this side only posts tiny messages. Where that is missing (older Safari) or the worker
// can't get a context, the same engine runs on the main thread from the shared rAF loop.
//
// Software GL (SwiftShader etc.) starts at the lowest quality; a main-thread watchdog (longtask) steps it down further
// if long tasks keep coming. `?liquid=full` skips that and pins full quality (for our own screenshot checks only).

import { createEngine } from './engine';
import { bindInput, hooks } from './field';
import { onFrame } from './loop';

const full = () => /[?&]liquid=full\b/.test(location.search);

function startWorker(canvas: HTMLCanvasElement, onFail: () => void): (() => void) | null {
  if (typeof Worker === 'undefined' || typeof canvas.transferControlToOffscreen !== 'function') return null;
  let worker: Worker;
  let off: OffscreenCanvas;
  try {
    worker = new Worker(new URL('./liquidWorker.ts', import.meta.url));
    off = canvas.transferControlToOffscreen();
  } catch {
    return null;
  }
  const post = (m: unknown, tr?: Transferable[]) => worker.postMessage(m, tr ?? []);
  const view = () => post({ type: 'view', w: innerWidth, h: innerHeight, dpr: devicePixelRatio || 1 });
  post(
    { type: 'init', canvas: off, origin: performance.timeOrigin, full: full(), w: innerWidth, h: innerHeight, dpr: devicePixelRatio || 1, scroll: scrollY },
    [off],
  );
  let failed = false;
  worker.onmessage = (e: MessageEvent) => {
    const m = e.data;
    if (m.type === 'fail') {
      failed = true;
      stop();
      onFail();
    } else if (m.type === 'ready') canvas.dataset.on = '';
    else if (m.type === 'stats') {
      canvas.dataset.frames = String(m.frames);
      canvas.dataset.live = String(m.live);
      canvas.dataset.q = String(m.q);
      canvas.dataset.soft = String(m.soft);
    }
  };
  worker.onerror = () => {
    if (!failed) {
      failed = true;
      stop();
      onFail();
    }
  };
  hooks.onAdd = (s, kind) => post({ type: 'src', x: s.x, y: s.y, t0: s.t0, amp: s.amp, size: s.size, kind });
  const unbind = bindInput();
  const onScroll = () => post({ type: 'scroll', y: scrollY });
  const onVis = () => post({ type: 'vis', hidden: document.hidden });
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', view);
  document.addEventListener('visibilitychange', onVis);

  // Watchdog: if long tasks keep landing on the main thread, the liquid is part of the problem (or must give way).
  let po: PerformanceObserver | null = null;
  if (!full()) {
    const recent: [number, number][] = [];
    let cool = 0;
    try {
      po = new PerformanceObserver((list) => {
        const t = performance.now();
        for (const en of list.getEntries()) recent.push([en.startTime, en.duration]);
        while (recent.length && recent[0][0] < t - 3000) recent.shift();
        const total = recent.reduce((a, r) => a + r[1], 0);
        if (recent.length >= 3 && total > 300 && t > cool) {
          cool = t + 2000;
          post({ type: 'down' });
        }
      });
      po.observe({ type: 'longtask', buffered: false });
    } catch {
      po = null;
    }
  }

  function stop() {
    hooks.onAdd = null;
    unbind();
    po?.disconnect();
    removeEventListener('scroll', onScroll);
    removeEventListener('resize', view);
    document.removeEventListener('visibilitychange', onVis);
    worker.terminate();
    delete canvas.dataset.on;
  }
  return stop;
}

function startMain(canvas: HTMLCanvasElement): (() => void) | null {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const engine = createEngine(gl, canvas, { full: full() });
  if (!engine) return null;
  const size = () => engine.setView(innerWidth, innerHeight, devicePixelRatio || 1);
  size();
  addEventListener('resize', size);
  const unbind = bindInput();
  canvas.dataset.on = '';
  let frames = 0;
  const off = onFrame((t) => {
    if (document.hidden) return;
    if (engine.draw(t, scrollY) && ++frames % 3 === 0) {
      canvas.dataset.frames = String(frames);
      canvas.dataset.live = String(engine.stats.live);
      canvas.dataset.q = String(engine.stats.q);
    }
  });
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

/**
 * Start the liquid on `canvas`. Returns a stop function, or null if neither path is available (the page stays plain
 * dark). A canvas that was handed to the worker can't get a context again, so a failed worker swaps in a fresh canvas.
 */
export function startLiquid(canvas: HTMLCanvasElement): (() => void) | null {
  let stopMain: (() => void) | null = null;
  const stopWorker = startWorker(canvas, () => {
    const fresh = canvas.cloneNode(false) as HTMLCanvasElement;
    canvas.replaceWith(fresh);
    stopMain = startMain(fresh);
  });
  if (stopWorker) return () => (stopWorker(), stopMain?.());
  return startMain(canvas);
}
