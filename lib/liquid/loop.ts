// The one animation loop. The liquid, the floating and the 3D scenes all register here, so a page runs a single
// requestAnimationFrame and a hidden tab runs none.

export type FrameCb = (t: number, dt: number) => void;

/** Seconds on the rAF clock (same origin as `t` in the callbacks); updated before any callback runs. */
export const clock = { t: typeof performance === 'undefined' ? 0 : performance.now() / 1000 };

const cbs = new Set<FrameCb>();
// `early` callbacks (layout readers) run before the others, so their reads see clean layout, not the frame's style writes.
const earlyCbs = new Set<FrameCb>();
let raf = 0;
let last = 0;
let bound = false;

function tick(now: number) {
  raf = requestAnimationFrame(tick);
  const t = now / 1000;
  const dt = last ? Math.min(0.1, t - last) : 1 / 60;
  last = t;
  clock.t = t;
  if (earlyCbs.size) for (const cb of [...earlyCbs]) cb(t, dt);
  for (const cb of [...cbs]) cb(t, dt);
}

function run() {
  if (!raf && (cbs.size || earlyCbs.size) && !document.hidden) raf = requestAnimationFrame(tick);
}

function onVisibility() {
  if (document.hidden) {
    cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
  } else run();
}

/** Call `cb(t, dt)` every frame (t and dt in seconds). Returns the function that stops it. */
export function onFrame(cb: FrameCb, opts?: { early?: boolean }) {
  if (!bound) {
    bound = true;
    document.addEventListener('visibilitychange', onVisibility);
  }
  const set = opts?.early ? earlyCbs : cbs;
  set.add(cb);
  run();
  return () => {
    set.delete(cb);
    if (!cbs.size && !earlyCbs.size) {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    }
  };
}
