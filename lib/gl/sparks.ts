// Rich tier for /sites: sparks thrown off the casting front (the Ember line that pours a concept site in).
//
// A few hundred CPU-simulated particles drawn by WebGL as short streaks with a hot head: born on the front line,
// thrown up and out, pulled down by gravity, cooling from white-hot to ember to nothing. The emission rate follows
// how fast the front is moving, so a quick scroll throws a shower and a still front just smoulders.
import { dropToLight } from '@/lib/tier';

import { createSparkCore, type Emitter, type SparkCore } from './sparksCore';

type Options = { canvas: HTMLCanvasElement; fronts: () => HTMLElement[]; onFail?: () => void };

export function startSparks({ canvas, fronts, onFail }: Options): () => void {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  let w = canvas.clientWidth, h = canvas.clientHeight;
  let worker: Worker | null = null;
  let core: SparkCore | null = null;
  let stopped = false, visible = true;
  let raf = 0, idleTimer = 0, last = 0, slow = 0;
  const lastY = new Map<HTMLElement, number>();

  function fail() {
    stop();
    dropToLight();
    onFail?.();
  }

  // Off the main thread where OffscreenCanvas can be handed over (the usual case); the main thread otherwise.
  if (typeof Worker !== 'undefined' && typeof canvas.transferControlToOffscreen === 'function') {
    try {
      worker = new Worker(new URL('./sparksWorker.ts', import.meta.url));
      const off = canvas.transferControlToOffscreen();
      worker.onmessage = (e) => e.data?.type === 'fail' && fail();
      worker.onerror = () => fail();
      worker.postMessage({ type: 'init', canvas: off, w, h, dpr }, [off]);
    } catch {
      worker = null;
    }
  }
  if (!worker) {
    core = createSparkCore(canvas);
    if (!core) {
      onFail?.();
      return () => {};
    }
    core.resize(w, h, dpr);
  }

  const size = () => {
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    if (worker) worker.postMessage({ type: 'size', w, h, dpr });
    else core?.resize(w, h, dpr);
  };
  const ro = new ResizeObserver(size);
  ro.observe(canvas);
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) loop();
    else worker?.postMessage({ type: 'em', ems: [] });
  });
  io.observe(canvas);

  // Where the fronts are and how fast they move (the DOM reads stay here); the worker (or `core`) does the rest.
  const frame = (now: number) => {
    raf = 0;
    if (stopped || !visible || document.hidden) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    const cr = canvas.getBoundingClientRect();
    const ems: Emitter[] = [];
    for (const f of fronts()) {
      const op = Number(getComputedStyle(f.parentElement!).opacity);
      if (op < 0.05) {
        lastY.delete(f);
        continue;
      }
      const r = f.getBoundingClientRect();
      if (!r.width) continue; // its cast is hidden
      const fy = r.top - cr.top;
      const speed = Math.abs(fy - (lastY.get(f) ?? fy)) / Math.max(dt, 0.001); // px/s
      lastY.set(f, fy);
      ems.push({ x: r.left - cr.left, y: fy, w: r.width, op, speed });
    }
    let alive = false;
    if (worker) {
      worker.postMessage({ type: 'em', ems });
      alive = ems.length > 0;
    } else if (core) {
      slow = dt > 0.024 ? slow + dt : Math.max(0, slow - dt);
      alive = core.frame(dt, ems, slow > 2 ? 0.35 : 1) || ems.length > 0;
    }
    if (alive) loop();
    else idle();
  };
  // With no front on screen and no sparks left, check back a few times a second instead of every frame.
  const idle = () => {
    last = 0;
    idleTimer = window.setTimeout(loop, 250);
  };
  function loop() {
    clearTimeout(idleTimer);
    if (!raf && !stopped) raf = requestAnimationFrame(frame);
  }
  function stop() {
    stopped = true;
    cancelAnimationFrame(raf);
    clearTimeout(idleTimer);
    io.disconnect();
    ro.disconnect();
    worker?.terminate();
  }
  const onVis = () => !document.hidden && loop();
  document.addEventListener('visibilitychange', onVis);
  loop();
  return () => {
    stop();
    document.removeEventListener('visibilitychange', onVis);
  };
}
