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
// Progress doesn't jump with the scroll position: it follows it like a critically damped spring with a top speed.
// Scroll faster and the scene plays faster, up to that cap; scroll in jerks (wheel notches, a flick, the keyboard,
// a dragged scrollbar) and it still plays as one smooth move. Pinned scenes get the most smoothing.

export type Mode = 'view' | 'enter' | 'pin' | 'reveal' | 'read';
type Entry = { el: HTMLElement; mode: Mode; cb?: (p: number) => void; last: number; v: number };

const entries = new Set<Entry>();
let raf = 0;
let bound = false;
let prev = 0;

const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Smoothing per mode: seconds to catch up, and the top speed in viewport heights of scrolling per second.
const FEEL: Record<Mode, { lag: number; vh: number }> = {
  pin: { lag: 0.2, vh: 2.2 },
  view: { lag: 0.1, vh: 6 },
  enter: { lag: 0.12, vh: 5 },
  reveal: { lag: 0.12, vh: 5 },
  read: { lag: 0.16, vh: 4 },
};

/** Progress for the element's current position, and how many px of scrolling take it from 0 to 1. */
function progress(mode: Mode, r: DOMRect, vh: number): [number, number] {
  if (mode === 'pin') return span(-r.top, Math.max(1, r.height - vh));
  if (mode === 'enter') return span(vh - r.top, vh * 0.6);
  if (mode === 'reveal') return span(vh - r.top, Math.max(1, Math.min(r.height, vh)));
  if (mode === 'read') return span(vh * 0.85 - r.top, Math.max(1, r.height + vh * 0.4));
  return span(vh - r.top, vh + r.height);
}
const span = (d: number, len: number): [number, number] => [clamp(d / len), len];

/** One step of a critically damped spring toward `to`, at most `max` per second (Unity's SmoothDamp). */
function follow(e: Entry, to: number, lag: number, max: number, dt: number) {
  const w = 2 / lag;
  const x = w * dt;
  const k = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const reach = max * lag;
  const change = Math.max(-reach, Math.min(reach, e.last - to));
  const goal = e.last - change;
  const t = (e.v + w * change) * dt;
  e.v = (e.v - w * t) * k;
  let p = goal + (change + t) * k;
  if (to - e.last > 0 === p > to) {
    p = to;
    e.v = 0;
  }
  return p;
}

function frame(now: number) {
  raf = 0;
  // Real elapsed time (the spring is stable for long frames), but not a pause such as a hidden tab.
  const dt = prev ? Math.min(0.1, (now - prev) / 1000) : 1 / 60;
  prev = now;
  const vh = innerHeight;
  const updates: [Entry, number][] = [];
  let moving = false;
  for (const e of entries) {
    const r = e.el.getBoundingClientRect();
    let p: number;
    if (r.bottom < -vh * 0.5 || r.top > vh * 1.5) {
      // Off-screen: settle at the nearest end so nothing is left half-animated.
      p = r.top > 0 ? 0 : 1;
      e.v = 0;
    } else {
      const [to, len] = progress(e.mode, r, vh);
      const { lag, vh: speed } = FEEL[e.mode];
      // First sight (load, restored scroll position) and reduced motion: no easing in.
      p = e.last < 0 || calm ? to : follow(e, to, lag, (speed * vh) / len, dt);
      if (Math.abs(to - p) > 0.0004) moving = true;
      else p = to;
    }
    if (Math.abs(p - e.last) > 0.00005) updates.push([e, p]);
  }
  for (const [e, p] of updates) {
    e.last = p;
    e.el.style.setProperty('--p', p.toFixed(4));
    e.cb?.(p);
  }
  // Keep going while anything is still catching up; otherwise sleep until the next scroll.
  if (moving) raf = requestAnimationFrame(frame);
  else prev = 0;
}
let calm = false;

export const requestScrollFrame = () => {
  if (!raf) raf = requestAnimationFrame(frame);
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
  expo: (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
};

/** Progress of `p` through the [from, to] window, clamped to 0..1. */
export const seg = (p: number, from: number, to: number) => clamp((p - from) / (to - from));
