// One scroll engine for every scroll-linked effect. Each tracked element gets a `--p` CSS variable
// (0 → 1) and an optional callback. All rects are read first, then all styles written, once per frame.
//
// Modes:
//   view  — 0 when the element's top enters the bottom of the viewport, 1 when its bottom leaves the top.
//   enter — 0 when the top enters the bottom of the viewport, 1 when the top reaches 40% from the top.
//   pin   — for a tall section with a sticky child: 0 when it reaches the top, 1 when its end does.
//   reveal — 0 when the top enters the bottom of the viewport, 1 once the whole element is on screen.

export type Mode = 'view' | 'enter' | 'pin' | 'reveal';
type Entry = { el: HTMLElement; mode: Mode; cb?: (p: number) => void; last: number };

const entries = new Set<Entry>();
let raf = 0;
let bound = false;

const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function progress(mode: Mode, r: DOMRect, vh: number) {
  if (mode === 'pin') return clamp(-r.top / Math.max(1, r.height - vh));
  if (mode === 'enter') return clamp((vh - r.top) / (vh * 0.6));
  if (mode === 'reveal') return clamp((vh - r.top) / Math.max(1, Math.min(r.height, vh)));
  return clamp((vh - r.top) / (vh + r.height));
}

function frame() {
  raf = 0;
  const vh = innerHeight;
  const updates: [Entry, number][] = [];
  for (const e of entries) {
    const r = e.el.getBoundingClientRect();
    if (r.bottom < -vh * 0.5 || r.top > vh * 1.5) {
      // Off-screen: settle at the nearest end so nothing is left half-animated.
      const p = r.top > 0 ? 0 : 1;
      if (p !== e.last) updates.push([e, p]);
      continue;
    }
    const p = progress(e.mode, r, vh);
    if (Math.abs(p - e.last) > 0.0004) updates.push([e, p]);
  }
  for (const [e, p] of updates) {
    e.last = p;
    e.el.style.setProperty('--p', p.toFixed(4));
    e.cb?.(p);
  }
}

export const requestScrollFrame = () => {
  if (!raf) raf = requestAnimationFrame(frame);
};

/** Track an element. Returns an untrack function. */
export function trackScroll(el: HTMLElement, mode: Mode, cb?: (p: number) => void) {
  const entry: Entry = { el, mode, cb, last: -1 };
  entries.add(entry);
  if (!bound) {
    bound = true;
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
