// One scroll engine for every scroll-linked effect. Each tracked element gets a `--p` CSS variable
// (0 → 1) and an optional callback. All rects are read first, then all styles written, once per frame.
//
// Modes:
//   view  — 0 when the element's top enters the bottom of the viewport, 1 when its bottom leaves the top.
//   enter — 0 when the top enters the bottom of the viewport, 1 when the top reaches 40% from the top.
//   pin   — for a tall section with a sticky child: 0 when it reaches the top, 1 when its end does.
//   reveal — 0 when the top enters the bottom of the viewport, 1 once the whole element is on screen.
//   read  — reading pace: 0 when the top is 85% down the viewport, 1 when the bottom is 45% down.
//
// Progress doesn't jump with the scroll position: it follows it like a critically damped spring (exact per frame, so
// frame-rate independent), with no speed cap, no deadline and nothing that ever lands it at once. Scroll steadily and
// the scene plays at the scroll's own pace, a few hundredths of a second behind (TAU); scroll in jerks (wheel notches,
// a flick, the keyboard, an anchor jump, a dragged scrollbar) and it plays as one smooth move. The time constant grows
// with the distance still to go (up to TAU_FAR at FAR), so a big jump starts gently instead of lurching, yet any jump
// (all of 0 → 1) has landed within ~0.57 s; small gaps keep the short one, so scrolling stays tight. It never moves
// past its target (it approaches no faster than it can stop), and while you scroll one way it only moves that way.
// <html data-scroll-settled> is set while every tracked progress is at its target.

export type Mode = 'view' | 'enter' | 'pin' | 'reveal' | 'read';
type Entry = { el: HTMLElement; mode: Mode; cb?: (p: number) => void; last: number; v: number };

const entries = new Set<Entry>();
let raf = 0;
let bound = false;
let prev = 0; // time of the last frame while running; 0 while asleep
let woke = 0; // time of the input that woke it

// Seconds: the time constant for small gaps (the lag behind a steady scroll is about twice it); parallax (view), which
// moves with the page, is a little tighter.
const TAU: Record<Mode, number> = { pin: 0.035, view: 0.03, enter: 0.035, reveal: 0.035, read: 0.035 };
const TAU_FAR = 0.075; // the time constant once the gap is FAR or more (a jump)
const FAR = 0.3;
const LAND = 0.0003; // within this of the target (and about to stop there) it is the target: an invisible last step
const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Progress for the element's current position. */
function progress(mode: Mode, r: DOMRect, vh: number): number {
  if (mode === 'pin') return clamp(-r.top / Math.max(1, r.height - vh));
  if (mode === 'enter') return clamp((vh - r.top) / (vh * 0.6));
  if (mode === 'reveal') return clamp((vh - r.top) / Math.max(1, Math.min(r.height, vh)));
  if (mode === 'read') return clamp((vh * 0.85 - r.top) / Math.max(1, r.height + vh * 0.4));
  return clamp((vh - r.top) / (vh + r.height));
}

/**
 * One exact step of a critically damped spring (position e.last, velocity e.v) toward `to` over dt seconds. The time
 * constant depends on the gap, but the velocity carries over, so a change of gap (a new wheel notch) only changes the
 * acceleration: the motion stays smooth. Returns false once it has landed.
 */
function follow(e: Entry, to: number, dt: number): boolean {
  const x = e.last - to;
  const g = Math.abs(x);
  const tau = TAU[e.mode] + (TAU_FAR - TAU[e.mode]) * Math.min(1, g / FAR);
  const w = 1 / tau;
  let v = e.v;
  // Approaching faster than it could stop at the target (the scroll turned back towards it): the spring would swing
  // past, so approach at the speed that lands exactly. Moving away (inertia after a turn) is left alone.
  if (x * (v + w * x) < 0) v = -w * x;
  const c = v + w * x;
  const k = Math.exp(-w * dt);
  const nx = (x + c * dt) * k;
  e.v = (v - w * c * dt) * k;
  e.last = to + nx;
  if (Math.abs(nx) < LAND && Math.abs(e.v) * tau < LAND) {
    e.last = to;
    e.v = 0;
    return false;
  }
  return true;
}

function frame(now: number) {
  raf = 0;
  // Real elapsed time (the steps are exact at any frame length): the first frame after a rest counts from the input
  // (at least one frame), so a slow frame still counts towards landing; a hidden tab simply lands on return.
  const dt = Math.min(1, Math.max(0, prev ? now - prev : Math.max(now - woke, 1000 / 60)) / 1000);
  prev = now;
  const vh = innerHeight;
  const updates: [Entry, number][] = [];
  let moving = false;
  for (const e of entries) {
    const r = e.el.getBoundingClientRect();
    const was = e.last;
    if (r.bottom < -vh * 0.5 || r.top > vh * 1.5) {
      // Off-screen: settle at the nearest end so nothing is left half-animated.
      e.last = r.top > 0 ? 0 : 1;
      e.v = 0;
    } else {
      const to = progress(e.mode, r, vh);
      // First sight (load, restored scroll position) and reduced motion: no easing in.
      if (was < 0 || calm) {
        e.last = to;
        e.v = 0;
      } else if (follow(e, to, dt)) moving = true;
    }
    if (e.last !== was) updates.push([e, e.last]);
  }
  for (const [e, p] of updates) {
    e.el.style.setProperty('--p', p.toFixed(4));
    e.cb?.(p);
  }
  // Keep going while anything is still on its way; otherwise sleep until the next scroll.
  if (moving) raf = requestAnimationFrame(frame);
  else {
    prev = 0;
    document.documentElement.setAttribute('data-scroll-settled', '');
  }
}
let calm = false;

export const requestScrollFrame = () => {
  document.documentElement.removeAttribute('data-scroll-settled');
  if (!raf) {
    // Asleep: the next frame's time runs from this input.
    if (!prev) woke = performance.now();
    raf = requestAnimationFrame(frame);
  }
};

/** Track an element. Returns an untrack function. */
export function trackScroll(el: HTMLElement, mode: Mode, cb?: (p: number) => void) {
  const entry: Entry = { el, mode, cb, last: -1, v: 0 };
  entries.add(entry);
  if (!bound) {
    bound = true;
    calm = reducedMotion();
    addEventListener('scroll', requestScrollFrame, { passive: true });
    addEventListener('resize', requestScrollFrame);
  }
  requestScrollFrame();
  return () => {
    entries.delete(entry);
  };
}

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Smooth, Apple-like curves for scroll segments. */
export const ease = {
  out: (t: number) => 1 - Math.pow(1 - t, 3),
  inOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  /** Gentler in-out (smoothstep): at most 1.5x the average rate, where inOut reaches 3x. */
  smooth: (t: number) => t * t * (3 - 2 * t),
  expo: (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
};

/** Progress of `p` through the [from, to] window, clamped to 0..1. */
export const seg = (p: number, from: number, to: number) => clamp((p - from) / (to - from));
