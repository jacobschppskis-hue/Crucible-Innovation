// What makes waves: the pointer's path, taps, finger drags, scrolling past a resting cursor or finger, and ripples shed by
// floating things. Events only record where the pointer went; once per frame that becomes drops, the classic water
// ripple: a moving pointer leaves a small ringing drop every ~24 px of its path (or every 0.1 s while it moves slowly).
// Each drop rings for a fraction of a second, so it sends out a short train of ripples; drops overlap into a wake that
// spreads behind the pointer: soft rings that keep spreading when it moves slowly, a V of ripple trains behind a flick.
// There is no steady push, so a fast path never leaves a trough. A tap is one bigger, longer drop.
//
// Touch: a finger that pans the page moves WITH the page, so in page space it barely moves; its drops come from how
// fast it moves on the glass, at the spot it touches. `touchmove` (passive) keeps arriving during a native pan, unlike
// pointer events (the browser cancels those). After the finger lifts, its last position on the glass acts like a
// resting cursor while the page keeps scrolling (momentum), and the page's motion past it makes the scroll wake.

import { clock } from './loop';
import type { Stamp } from './sim';

/** Tunables (the look lab overrides them). osc: ripple frequency of a drop (Hz; wavelength = wave speed / osc). gap:
 *  px of path between drops; every: s between drops while moving slowly. rate: strength per second at 400 px/s
 *  (velocity kicks, px of height per second). drop / tap: how long a drop rings (s) and its decay (s). tapK: a tap's
 *  strength relative to one second of moving. */
export const TUNE = { osc: 8.5, gap: 24, every: 0.1, rate: 120, dropLen: 0.24, dropTau: 0.07, tapK: 0.9, tapLen: 0.5, tapTau: 0.14 };
const K_SCROLL = 0.75; // the page moving past a resting pointer (relative)
const K_PAN = 0.8; // a finger panning the page (relative, by its speed on the glass)
const TAP_PX = 10; // travel between down and up above which it was a drag, not a tap
const TAP_MS = 800;
/** Strength (relative) for a speed in px/s: fades in from ~10 px/s, 1 at 400 px/s, at most 2.3 (a flick splashes). */
const strength = (v: number) => {
  const on = Math.min(1, Math.max(0, (v - 8) / 50));
  return on * on * (3 - 2 * on) * (0.55 + (0.45 * Math.min(v, 1600)) / 400);
};

export type Kind = 'move' | 'tap' | 'scroll' | 'touch' | 'float';
export type SourceRec = { x: number; y: number; t0: number; amp: number; kind: Kind };

type Burst = { x: number; y: number; a: number; t0: number; len: number; tau: number; s: number };

type Ptr = {
  cx: number; // client px now
  cy: number;
  lx: number; // page px at the end of the last frame (NaN: start fresh)
  ly: number;
  lcx: number; // client px at the end of the last frame
  lcy: number;
  lcx0: number; // and the frame before (was it resting while the page moved?)
  lcy0: number;
  pts: number[]; // page px of the events since the last frame
  speed: number; // px/s, smoothed
  rem: number; // px of path until the next drop
  lastDrop: number; // clock time of the last drop
  agg: number; // px of path since the last notification (interim 3D sources)
  aggT: number;
};

const fresh = (): Ptr => ({ cx: 0, cy: 0, lx: NaN, ly: NaN, lcx: 0, lcy: 0, lcx0: 0, lcy0: 0, pts: [], speed: 0, rem: 0, lastDrop: -9, agg: 0, aggT: 0 });

/**
 * Listen to the page. `notify` hears a coarse version of the same events (a point every ~40 px of travel, taps), for
 * the 3D workers that still keep their own interim field (see field.ts). Returns the per-frame `stamps(dt, cell)`,
 * `drop()` for ripples of floating things, and the unbind.
 */
export function createInput(notify: (x: number, y: number, amp: number, size: number) => void) {
  const mouse = fresh();
  const finger = fresh();
  let mouseIn = false;
  let fingerOn = false;
  let fingerDown = false;
  let fingerSeen = 0; // clock time of the last finger event or page scroll while the finger is on
  let fingerUp = 0;
  let lastScroll = NaN; // read in the first frame, not at start-up (it could force a layout into the loading task)
  let down: { x: number; y: number; t: number; id: number } | null = null;
  const taps: { x: number; y: number; touch: boolean }[] = [];
  const bursts: Burst[] = [];
  const recent: SourceRec[] = [];
  let live: number[] = []; // clock times of input events that made waves (the canvas' data-live)
  let lastUser = -9; // clock time of the last drop the visitor made

  const now = () => (typeof performance === 'undefined' ? clock.t : Math.max(clock.t, performance.now() / 1000));

  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') {
      fingerAt(e.clientX, e.clientY, e.pageX, e.pageY);
      return;
    }
    mouseIn = true;
    const list = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    if (list.length > 1) for (const c of list) mouse.pts.push(c.pageX, c.pageY);
    else mouse.pts.push(e.pageX, e.pageY);
    mouse.cx = e.clientX;
    mouse.cy = e.clientY;
  };
  const fingerAt = (cx: number, cy: number, px: number, py: number) => {
    if (!fingerOn) {
      fingerOn = true;
      finger.lx = NaN; // a new touch never draws a line from where the last one ended
      finger.pts.length = 0;
    }
    finger.cx = cx;
    finger.cy = cy;
    finger.pts.push(px, py);
    fingerSeen = clock.t;
  };
  const onTouch = (e: TouchEvent) => {
    const tc = e.touches[0];
    if (!tc) return;
    if (e.type === 'touchstart') {
      fingerOn = false;
      fingerDown = true;
    }
    fingerAt(tc.clientX, tc.clientY, tc.pageX, tc.pageY);
  };
  const onTouchEnd = (e: TouchEvent) => {
    if (e.touches.length) return;
    fingerDown = false;
    fingerUp = clock.t;
  };
  const onDown = (e: PointerEvent) => {
    down = { x: e.pageX, y: e.pageY, t: now(), id: e.pointerId };
    if (e.pointerType === 'touch') {
      fingerOn = false;
      fingerDown = true;
      fingerAt(e.clientX, e.clientY, e.pageX, e.pageY);
    }
  };
  // A tap is one drop, made when the pointer comes up where it went down. Anything that travelled already made its wake.
  const onUp = (e: PointerEvent) => {
    const d = down;
    down = null;
    // (a pointercancel on touch is the browser taking over the pan: the finger is still down, touchmove goes on)
    if (e.type !== 'pointerup' || !d || d.id !== e.pointerId) return;
    if (e.pointerType === 'touch') {
      fingerDown = false;
      fingerUp = clock.t;
    }
    if (Math.hypot(e.pageX - d.x, e.pageY - d.y) <= TAP_PX && (now() - d.t) * 1000 < TAP_MS) taps.push({ x: e.pageX, y: e.pageY, touch: e.pointerType === 'touch' });
  };
  const onLeave = () => {
    mouseIn = false;
    mouse.lx = NaN;
    mouse.pts.length = 0;
  };

  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerdown', onDown, { passive: true });
  addEventListener('pointerup', onUp, { passive: true });
  addEventListener('pointercancel', onUp, { passive: true });
  addEventListener('touchstart', onTouch, { passive: true });
  addEventListener('touchmove', onTouch, { passive: true });
  addEventListener('touchend', onTouchEnd, { passive: true });
  addEventListener('touchcancel', onTouchEnd, { passive: true });
  document.addEventListener('pointerleave', onLeave);

  const record = (x: number, y: number, amp: number, kind: Kind, t: number) => {
    recent.push({ x, y, t0: t, amp, kind });
    if (recent.length > 4000) recent.splice(0, recent.length - 3000);
  };

  const sigma = { s: 10.4 };
  /** A ringing drop at page px (x, y): `a` = its total strength (velocity kicks summed over its life, px). */
  function burst(x: number, y: number, a: number, t0: number, len = TUNE.dropLen, tau = TUNE.dropTau, s = sigma.s, user = true) {
    if (user) lastUser = Math.max(lastUser, t0);
    // normalise so `a` is the drop's total (the ringing envelope integrates to about tau)
    bursts.push({ x, y, a: a / tau, t0, len, tau, s });
  }

  /** Walk one pointer's path since the last frame and leave drops along it. */
  function trace(P: Ptr, dt: number, t: number, scrolled: boolean, touch: boolean) {
    const x1 = P.cx + scrollX;
    const y1 = P.cy + scrollY;
    if (Number.isNaN(P.lx)) {
      P.lx = x1;
      P.ly = y1;
      P.lcx = P.lcx0 = P.cx;
      P.lcy = P.lcy0 = P.cy;
      P.pts.length = 0;
      P.speed = 0;
      P.rem = TUNE.gap * 0.5;
      return;
    }
    // the path in page px: last end, the events' own points, now
    const path = [P.lx, P.ly];
    for (let i = 0; i < P.pts.length; i += 2) path.push(P.pts[i], P.pts[i + 1]);
    path.push(x1, y1);
    P.pts.length = 0;
    let L = 0;
    for (let i = 2; i < path.length; i += 2) L += Math.hypot(path[i] - path[i - 2], path[i + 1] - path[i - 1]);
    const Lc = Math.hypot(P.cx - P.lcx, P.cy - P.lcy); // on the glass (a finger panning the page)
    P.lcx0 = P.lcx;
    P.lcy0 = P.lcy;
    P.lx = x1;
    P.ly = y1;
    P.lcx = P.cx;
    P.lcy = P.cy;
    const inst = Math.max(L, touch ? Lc : 0) / Math.max(dt, 1 / 240);
    P.speed = P.speed ? P.speed + (inst - P.speed) * 0.5 : inst;
    // a jump (anchor link, restored scroll, a pointer that left and came back): no wave across the page
    if (L > Math.max(600, 6000 * dt)) return;
    const fs = strength(P.speed);
    if (fs <= 0) return;
    // the page moving past a pointer that rests on the glass: the scroll wake
    const still = Math.hypot(P.cx - P.lcx0, P.cy - P.lcy0) < 1;
    const byScroll = scrolled && still && L > 0.5;
    const kind: Kind = byScroll ? 'scroll' : touch ? 'touch' : 'move';
    const k = TUNE.rate * fs * (byScroll ? K_SCROLL : 1);
    // A finger panning the page: drops at the spot it holds, by its speed on the glass.
    const pan = touch ? Lc - L : 0;
    if (pan > 1.5 && t - P.lastDrop >= TUNE.every * 0.6) {
      burst(x1, y1, TUNE.rate * fs * K_PAN * Math.min(0.2, t - P.lastDrop), t);
      record(x1, y1, k, 'touch', t);
      P.lastDrop = t;
      live.push(t);
      coarse(P, x1, y1, pan, fs, t);
    }
    if (L <= 0.5) return;
    // drops every `gap` px along the path; a slow pointer drops at least every `every` s where it is
    let s = 0;
    let next = P.rem;
    const t0 = t - dt;
    for (let i = 2; i < path.length; i += 2) {
      const ax = path[i - 2];
      const ay = path[i - 1];
      const bx = path[i];
      const by = path[i + 1];
      const l = Math.hypot(bx - ax, by - ay);
      while (next <= s + l) {
        const u = l ? (next - s) / l : 1;
        const tt = t0 + (dt * next) / L;
        const x = ax + (bx - ax) * u;
        const y = ay + (by - ay) * u;
        burst(x, y, k * Math.min(0.2, Math.max(1 / 240, tt - P.lastDrop)), tt);
        record(x, y, k, kind, tt);
        P.lastDrop = tt;
        next += TUNE.gap;
      }
      s += l;
    }
    P.rem = next - s;
    if (t - P.lastDrop >= TUNE.every) {
      burst(x1, y1, k * Math.min(0.2, t - P.lastDrop), t);
      record(x1, y1, k, kind, t);
      P.lastDrop = t;
      P.rem = TUNE.gap;
    }
    live.push(t);
    coarse(P, x1, y1, L, fs, t);
  }

  // The interim 3D field hears a point every ~40 px of travel or 80 ms (v1 units: amp ~0.25..0.6, size 20).
  function coarse(P: Ptr, x: number, y: number, len: number, fs: number, t: number) {
    P.agg += len;
    if (P.agg >= 40 || t - P.aggT > 0.08) {
      P.agg = 0;
      P.aggT = t;
      notify(x, y, 0.2 + 0.25 * Math.min(1.5, fs), 20);
    }
  }

  /** A floating thing's ripple (or the pour landing): a drop of total strength `a` (px of velocity kicks). */
  function drop(x: number, y: number, a: number) {
    burst(x, y, a, clock.t, TUNE.dropLen * 1.3, TUNE.dropTau * 1.2, sigma.s, false);
    record(x, y, a, 'float', clock.t);
  }

  /** This frame's impulses (sorted by when in the frame), for `sim.advance(dt, stamps)`. */
  function stamps(dt: number, cell: number): Stamp[] {
    const t = clock.t;
    sigma.s = cell * 1.3;
    const sy = scrollY;
    const scrolled = !Number.isNaN(lastScroll) && Math.abs(sy - lastScroll) > 0.25;
    lastScroll = sy;
    for (const tp of taps) {
      const a = TUNE.rate * TUNE.tapK * (tp.touch ? 1.1 : 1);
      burst(tp.x, tp.y, a, t - dt, TUNE.tapLen, TUNE.tapTau, sigma.s * 1.15);
      record(tp.x, tp.y, a, 'tap', t);
      live.push(t);
      notify(tp.x, tp.y, tp.touch ? 2.1 : 1.9, 24);
    }
    taps.length = 0;
    if (mouseIn) trace(mouse, dt, t, scrolled, false);
    if (fingerOn) {
      if (scrolled) fingerSeen = t;
      // The finger's spot keeps making a scroll wake while the page still moves after it lifted (momentum). A finger
      // whose pan the browser took over without telling us when it ended (no touch events) times out.
      if (t - fingerSeen > (fingerDown ? 1.5 : 0.3) || (!fingerDown && t - fingerUp > 4)) {
        fingerOn = false;
        fingerDown = false;
        finger.lx = NaN;
      } else trace(finger, dt, t, scrolled, true);
    }
    // every live drop rings: 4 samples per frame (smooth at 120 Hz substeps), each with its moment in the frame
    const out: Stamp[] = [];
    const J = 4;
    const w = 2 * Math.PI * TUNE.osc;
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      for (let j = 0; j < J; j++) {
        const f = (j + 0.5) / J;
        const tau = t - dt + f * dt - b.t0;
        if (tau < 0 || tau > b.len) continue;
        const env = Math.exp(-tau / b.tau) * (1 - tau / b.len);
        out.push({ x: b.x, y: b.y, a: (b.a * env * Math.cos(w * tau) * dt) / J, s: b.s, f });
      }
      if (t - b.t0 > b.len) bursts.splice(i, 1);
    }
    out.sort((a, b) => a.f - b.f);
    return out;
  }

  /** Input events that made waves within the last 3 s. */
  function liveCount(t = clock.t) {
    if (live.length && live[0] < t - 3) live = live.filter((v) => v >= t - 3);
    return live.length;
  }

  function sources(since = -Infinity) {
    return recent.filter((s) => s.t0 >= since);
  }

  function unbind() {
    removeEventListener('pointermove', onMove);
    removeEventListener('pointerdown', onDown);
    removeEventListener('pointerup', onUp);
    removeEventListener('pointercancel', onUp);
    removeEventListener('touchstart', onTouch);
    removeEventListener('touchmove', onTouch);
    removeEventListener('touchend', onTouchEnd);
    removeEventListener('touchcancel', onTouchEnd);
    document.removeEventListener('pointerleave', onLeave);
  }

  return { stamps, drop, liveCount, sources, record, unbind, lastUser: () => lastUser };
}
