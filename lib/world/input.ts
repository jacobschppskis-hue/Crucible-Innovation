// The visitor's hand on the molten sea: mouse and fingers become the boats of wake.ts.
//
// - mouse: hovering leaves a gentle wake, a held button (a drag) a 1.85x one; a cursor resting while the page scrolls
//   still leaves one, since the camera moves the sea under it (it is sampled every frame, not only on events); a click
//   that doesn't move is one clean ring;
// - finger: the wake follows it while it drags and while the page scrolls under it; after it lifts, the spot it let go
//   of rides on through the scroll's momentum for ~1.2 s, fading; a tap (short, still, no scroll) is a ring; a second
//   finger has its own stroke;
// - events are queued and stamped on the one clock at frame time, spread evenly since the last frame (touchmoves come
//   in bursts); coalesced pointer events are used where the browser has them; a 35 ms low-pass on the screen position
//   (pointers report whole pixels, fingers jitter) keeps the arms from zigzagging.
// Nothing here reads layout. `pick` (the engine's hitSea) turns a screen point into a point on the sea.

import type { Stroke, Wake } from './wake';

/** strength: a hovering cursor's wake at 400 px/s (px of height, as the production liquid), drag / touch / scroll
 *  multipliers, the finger's coast after lift (s). */
export const HAND = { amp: 2.6, drag: 1.85, touch: 1.5, scroll: 0.8, coast: 1.2, lowpass: 0.035 };

/** Relative strength for a speed in px/s: fades in from a crawl (~8 px/s), 0.75 at 100 px/s, 1 at 400, at most 1.75. */
const strength = (v: number) => {
  const on = Math.min(1, Math.max(0, (v - 8) / 40));
  return on * on * (3 - 2 * on) * (0.67 + (0.33 * Math.min(v, 1300)) / 400);
};

/** A point on the sea: surface coords (u, v) and sc = units per CSS px there. */
export type Pick = (x: number, y: number) => { u: number; v: number; sc: number } | null;

type Hand = {
  st: Stroke;
  on: boolean;
  touch: boolean;
  down: boolean;
  id: number;
  x: number;
  y: number;
  q: [number, number][];
  fx: number;
  fy: number;
  ft: number;
  coast: number;
  lift: number;
  last: { u: number; v: number } | null;
};

export function createInput(wake: Wake, win: Window = window) {
  const hand = (): Hand => ({ st: wake.stroke(), on: false, touch: false, down: false, id: -1, x: 0, y: 0, q: [], fx: NaN, fy: NaN, ft: 0, coast: 0, lift: -9, last: null });
  const H = [hand(), hand()];
  const taps: [number, number][] = [];
  let now = 0;
  let enabled = true;
  let downAt: { x: number; y: number; t: number } | null = null;
  let touchStart: { x: number; y: number; t: number; sy: number } | null = null;
  const events: number[] = [];

  const push = (h: Hand, x: number, y: number) => {
    if (!enabled) return;
    h.q.push([x, y]);
    h.x = x;
    h.y = y;
    events.push(now);
  };
  const stop = (h: Hand) => {
    wake.end(h.st);
    h.last = null;
    h.fx = NaN;
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const h = H[0];
    h.on = true;
    h.touch = false;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    for (const c of evs.length ? evs : [e]) push(h, c.clientX, c.clientY);
  };
  const onDown = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    H[0].down = true;
    downAt = { x: e.clientX, y: e.clientY, t: now };
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    H[0].down = false;
    if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 6 && now - downAt.t < 0.35) taps.push([e.clientX, e.clientY]);
    downAt = null;
  };
  const onLeave = () => {
    H[0].on = false;
    stop(H[0]);
  };
  const onTouchStart = (e: TouchEvent) => {
    const t = e.changedTouches[0];
    if (!t) return;
    const [a, b] = H;
    if (a.id < 0) {
      stop(a);
      Object.assign(a, { id: t.identifier, on: true, touch: true, coast: 0 });
      push(a, t.clientX, t.clientY);
      touchStart = { x: t.clientX, y: t.clientY, t: now, sy: win.scrollY };
    } else if (b.id < 0) {
      stop(b);
      Object.assign(b, { id: t.identifier, on: true, touch: true, coast: 0 });
      push(b, t.clientX, t.clientY);
    }
  };
  const onTouchMove = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) for (const h of H) if (t.identifier === h.id) push(h, t.clientX, t.clientY);
  };
  const onTouchEnd = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      const [a, b] = H;
      if (t.identifier === a.id) {
        a.id = -1;
        a.coast = 1;
        a.lift = now;
        if (touchStart && Math.hypot(t.clientX - touchStart.x, t.clientY - touchStart.y) < 8 && now - touchStart.t < 0.3 && Math.abs(win.scrollY - touchStart.sy) < 4) taps.push([t.clientX, t.clientY]);
      } else if (t.identifier === b.id) {
        b.id = -1;
        b.on = false;
        stop(b);
      }
    }
  };

  const pass = { passive: true } as const;
  win.addEventListener('pointermove', onMove, pass);
  win.addEventListener('pointerdown', onDown, pass);
  win.addEventListener('pointerup', onUp, pass);
  win.document.documentElement.addEventListener('mouseleave', onLeave, pass);
  win.addEventListener('touchstart', onTouchStart, pass);
  win.addEventListener('touchmove', onTouchMove, pass);
  win.addEventListener('touchend', onTouchEnd, pass);
  win.addEventListener('touchcancel', onTouchEnd, pass);

  /** One pointer's frame: its queued screen points (or where it rests) become a path on the sea. */
  function track(h: Hand, t0: number, t1: number, k: number, pick: Pick) {
    const pts = h.q.length ? h.q.splice(0) : [[h.x, h.y] as [number, number]];
    const path: number[] = [];
    let sc = 0;
    pts.forEach(([x, y], i) => {
      const t = t0 + ((t1 - t0) * (i + 1)) / pts.length;
      if (!Number.isNaN(h.fx)) {
        const e = 1 - Math.exp(-Math.max(t - h.ft, 1 / 480) / HAND.lowpass);
        x = h.fx + (x - h.fx) * e;
        y = h.fy + (y - h.fy) * e;
      }
      h.fx = x;
      h.fy = y;
      h.ft = t;
      const w = pick(x, y);
      if (!w) return;
      if (!path.length && h.last) path.push(h.last.u, h.last.v);
      path.push(w.u, w.v);
      sc = w.sc;
    });
    if (!sc) {
      stop(h);
      return;
    }
    if (path.length < 4) {
      h.last = { u: path[0], v: path[1] };
      return;
    }
    let L = 0;
    for (let i = 2; i < path.length; i += 2) L += Math.hypot(path[i] - path[i - 2], path[i + 1] - path[i - 1]);
    const vel = L / sc / Math.max(t1 - t0, 1 / 240);
    wake.move(h.st, path, t0, t1, vel, HAND.amp * strength(vel) * k, sc);
    h.last = { u: path[path.length - 2], v: path[path.length - 1] };
  }

  /** Each frame, before the wake is packed: this frame's input becomes wake samples between clock times t0 and t1. */
  function step(t0: number, t1: number, pick: Pick) {
    now = t1;
    if (!enabled) {
      for (const h of H) h.q.length = 0;
      taps.length = 0;
      return;
    }
    const [a, b] = H;
    if (a.touch) {
      if (a.id >= 0) track(a, t0, t1, HAND.touch, pick);
      else if (a.coast > 0) {
        a.coast = Math.max(0, 1 - (t1 - a.lift) / HAND.coast);
        if (a.coast > 0) track(a, t0, t1, HAND.touch * a.coast, pick);
        else {
          stop(a);
          a.on = false;
        }
      }
    } else if (a.on) track(a, t0, t1, a.down ? HAND.drag : 1, pick);
    if (b.id >= 0) track(b, t0, t1, HAND.touch, pick);
    for (const [x, y] of taps) {
      const w = pick(x, y);
      if (w) wake.tap(w.u, w.v, w.sc, t1);
    }
    taps.length = 0;
    while (events.length && t1 - events[0] > 3) events.shift();
  }

  function destroy() {
    win.removeEventListener('pointermove', onMove);
    win.removeEventListener('pointerdown', onDown);
    win.removeEventListener('pointerup', onUp);
    win.document.documentElement.removeEventListener('mouseleave', onLeave);
    win.removeEventListener('touchstart', onTouchStart);
    win.removeEventListener('touchmove', onTouchMove);
    win.removeEventListener('touchend', onTouchEnd);
    win.removeEventListener('touchcancel', onTouchEnd);
  }

  return {
    step,
    destroy,
    /** the live strokes (for the wake's tips) */
    heads: () => H.map((h) => h.st),
    /** input events that made waves in the last 3 s */
    get live() {
      return events.length;
    },
    set enabled(v: boolean) {
      enabled = v;
    },
  };
}

export type Input = ReturnType<typeof createInput>;
