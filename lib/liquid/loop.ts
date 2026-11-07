// The one clock. The liquid's simulation, the floating, the 3D poses and every renderer register here, so a page runs a
// single requestAnimationFrame, a hidden tab runs none, and everything that moves agrees on the time. Workers never
// keep their own animation time: the main frame posts `t` (seconds, the rAF timestamp / 1000 of the frame that made
// it) and they draw exactly that.
//
// `window.__clock` lets a test harness drive time deterministically:
//   pause()            freeze the clock (real frames keep coming but nothing advances)
//   step(ms)           advance by ms and run exactly one frame; resolves once every renderer has drawn it
//   resume()           back to real time, continuing from where it was paused
//   settle(t)          resolves once every running renderer (main thread or worker) has drawn the latest frame at or
//                      before t (works with Playwright's page.clock, whose fake rAF runs on a 16 ms grid)
//   renderers()        [{name, path, drawn, paused}]
//   now()              the clock's current time (s)

export type FrameCb = (t: number, dt: number) => void;

/** Seconds on the one clock (the rAF timestamp / 1000, minus any time spent paused); set before any callback runs. */
export const clock = { t: typeof performance === 'undefined' ? 0 : performance.now() / 1000, frame: 0 };

const cbs = new Set<FrameCb>();
// `early` callbacks (layout readers) run before the others, so their reads see clean layout, not the frame's style writes.
const earlyCbs = new Set<FrameCb>();
let raf = 0;
let last = 0;
let bound = false;
let paused = false;
let offset = 0; // seconds subtracted from the rAF time (time spent paused)
let resync = false;

function run(t: number, dt: number) {
  clock.t = t;
  clock.frame++;
  if (earlyCbs.size) for (const cb of [...earlyCbs]) cb(t, dt);
  for (const cb of [...cbs]) cb(t, dt);
  check();
}

function tick(now: number) {
  raf = requestAnimationFrame(tick);
  if (paused) return;
  if (resync) {
    resync = false;
    offset = now / 1000 - clock.t - 1 / 60;
  }
  const t = now / 1000 - offset;
  const dt = last ? Math.min(0.1, Math.max(0, t - last)) : 1 / 60;
  last = t;
  run(t, dt);
}

function start() {
  if (!raf && (cbs.size || earlyCbs.size) && !document.hidden) raf = requestAnimationFrame(tick);
}

function onVisibility() {
  if (document.hidden) {
    cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
  } else start();
  check();
}

/** Call `cb(t, dt)` every frame (t and dt in seconds). Returns the function that stops it. */
export function onFrame(cb: FrameCb, opts?: { early?: boolean }) {
  if (!bound && typeof document !== 'undefined') {
    bound = true;
    document.addEventListener('visibilitychange', onVisibility);
    install();
  }
  const set = opts?.early ? earlyCbs : cbs;
  set.add(cb);
  start();
  return () => {
    set.delete(cb);
    if (!cbs.size && !earlyCbs.size) {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    }
  };
}

// --- renderers: everything that draws on this clock reports the time of the frame it drew --------------------------

export type Renderer = { name: string; path: 'worker' | 'main'; drawn: number; paused: boolean };
export type RendererHandle = Renderer & {
  /** The frame for time t is drawn (and committed). */
  done(t: number): void;
  setPaused(p: boolean): void;
  off(): void;
};

const renderers = new Set<RendererHandle>();
const waiters: { t: number; res: () => void }[] = [];

/** Register something that draws frames for this clock (the liquid, a 3D scene). */
export function renderer(name: string, path: 'worker' | 'main'): RendererHandle {
  const r: RendererHandle = {
    name,
    path,
    drawn: -1,
    paused: false,
    done(t) {
      if (t > r.drawn) r.drawn = t;
      check();
    },
    setPaused(p) {
      r.paused = p;
      check();
    },
    off() {
      renderers.delete(r);
      check();
    },
  };
  renderers.add(r);
  install();
  return r;
}

function satisfied(t: number) {
  // The latest frame the clock has produced at or before t; renderers must have drawn at least that one.
  const want = Math.min(t, clock.t) - 1e-6;
  const hidden = typeof document !== 'undefined' && document.hidden;
  for (const r of renderers) if (!r.paused && !hidden && r.drawn < want) return false;
  return true;
}

function check() {
  for (let i = waiters.length - 1; i >= 0; i--) {
    if (satisfied(waiters[i].t)) {
      const w = waiters[i];
      waiters.splice(i, 1);
      w.res();
    }
  }
}

// A harness that drives time (settle() called, pause(), or Playwright's fake clock, whose performance.now is not native)
// takes real seconds per frame: nothing may adapt its quality to that.
let stepped = false;
const fakeClock = (() => {
  try {
    return typeof performance !== 'undefined' && !/\[native code\]/.test(Function.prototype.toString.call(performance.now));
  } catch {
    return false;
  }
})();

function settle(t: number): Promise<void> {
  stepped = true;
  return new Promise((res) => {
    if (satisfied(t)) res();
    else waiters.push({ t, res });
  });
}

// --- window.__clock ---------------------------------------------------------------------------------------------------

type ClockApi = {
  v: 1;
  now(): number;
  pause(): void;
  step(ms?: number): Promise<void>;
  resume(): void;
  settle(t: number): Promise<void>;
  renderers(): Renderer[];
  readonly paused: boolean;
};

function install() {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { __clock?: ClockApi };
  if (w.__clock) return;
  w.__clock = {
    v: 1,
    now: () => clock.t,
    pause() {
      paused = true;
    },
    step(ms = 1000 / 60) {
      paused = true;
      const dt = Math.max(0, ms) / 1000;
      const t = clock.t + dt;
      last = t;
      run(t, dt);
      return settle(t);
    },
    resume() {
      if (!paused) return;
      paused = false;
      resync = true;
      last = 0;
      start();
    },
    settle,
    renderers: () => [...renderers].map(({ name, path, drawn, paused: p }) => ({ name, path, drawn, paused: p })),
    get paused() {
      return paused;
    },
  };
}

/** True while a harness drives the clock (stepped time): adaptive quality must not react to its long frames. */
export const clockHeld = () => paused || stepped || fakeClock;
