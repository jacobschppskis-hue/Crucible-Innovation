// What makes waves: the pointer's path (the wake, wake.ts), taps (one drop in the wave grid), ripples shed by floating
// things. Events only record where the pointer went; once per frame that becomes wake samples and drops.
//
// A moving pointer leaves a boat's wake (wake.ts): a V of two clean arms behind it at every speed, never rings from
// the points it passed. Its strength follows the pointer's speed (fading in from a crawl, growing to a splash for a
// flick), and a mouse dragged with the button held or a finger on the glass leaves a stronger, more marked wake than a
// hovering cursor.
//
// Scroll: a cursor resting on the glass while the page scrolls moves through the water (anchored to the page) at the
// scroll's speed, so it leaves the same wake along that path (in page px: it trails with the page).
//
// Touch: a finger that pans the page moves WITH the page, so in page space it barely moves; what the eye follows is
// its path on the glass, so a finger's wake lives in viewport px: the trail it draws on the screen. `touchmove`
// (passive) keeps arriving during a native pan, unlike pointer events (the browser cancels those). After the finger
// lifts while the page keeps scrolling (momentum), the spot it let go of rides on with the page and keeps drawing the
// same trail, slowing with the scroll, until the page stops.

import { clock } from './loop';
import type { Stamp } from './sim';
import { createWake, type WakeStroke } from './wake';

/** Tunables (the look lab overrides them). amp: a hovering cursor's wake at 400 px/s (px of height); drag: a mouse
 *  button held or a finger on the glass, relative; scroll: a resting cursor the page scrolls past, relative; momentum:
 *  the spot a finger let go of while the page scrolls on, relative. gap / every: px of path or s between recorded
 *  sources (`__liquid.sources()`). osc: a drop's ringing (Hz); dropLen / dropTau: how long a floater's drop rings and its
 *  decay (s); tapK / tapLen / tapTau: a tap's total strength (px of velocity kicks / rate), ring time, decay. */
export const TUNE = { amp: 2.6, drag: 1.85, scroll: 0.8, momentum: 1.5, gap: 24, every: 0.1, osc: 8.5, rate: 70, dropLen: 0.24, dropTau: 0.07, tapK: 0.9, tapLen: 0.5, tapTau: 0.14 };
const TAP_PX = 10; // travel between down and up above which it was a drag, not a tap
const TAP_MS = 800;
/** Strength (relative) for a speed in px/s: fades in from a crawl (~8 px/s), 0.75 at 100 px/s, 1 at 400 px/s, at most
 *  1.75 (a flick). */
const strength = (v: number) => {
  const on = Math.min(1, Math.max(0, (v - 8) / 40));
  return on * on * (3 - 2 * on) * (0.67 + (0.33 * Math.min(v, 1300)) / 400);
};

export type Kind = 'move' | 'tap' | 'scroll' | 'touch' | 'float';
export type SourceRec = { x: number; y: number; t0: number; amp: number; kind: Kind };

type Burst = { x: number; y: number; a: number; t0: number; len: number; tau: number; s: number; w: number };

type Ptr = {
  cx: number; // client px now
  cy: number;
  lx: number; // last frame's end of the path, in the stroke's frame (NaN: start fresh)
  ly: number;
  lcx0: number; // client px a frame ago (was a cursor resting while the page moved?)
  lcy0: number;
  pts: number[]; // the events' points since the last frame, in the stroke's frame
  speed: number; // px/s along the path, smoothed
  rem: number; // px of path until the next recorded source
  lastRec: number; // clock time of the last recorded source
  agg: number; // px of path since the last notification (3D)
  aggT: number;
  st: WakeStroke;
};

/**
 * Listen to the page. `notify` hears a coarse version of the same events (a point every ~40 px of travel, taps), for
 * the liveness count (field.ts). Returns the per-frame `stamps(dt, cell)` (drops for the grid; the wake samples go to
 * `wake`, drawn with `heads()`), `drop()` for ripples of floating things, and the unbind.
 */
export function createInput(notify: (x: number, y: number, amp: number, size: number) => void) {
  const wake = createWake();
  const ptr = (fr: 0 | 1): Ptr => ({ cx: 0, cy: 0, lx: NaN, ly: NaN, lcx0: 0, lcy0: 0, pts: [], speed: 0, rem: 0, lastRec: -9, agg: 0, aggT: 0, st: wake.stroke(fr) });
  const mouse = ptr(0); // page px
  const finger = ptr(1); // viewport px
  let mouseIn = false;
  let buttons = 0; // mouse buttons held
  let fingerDown = false;
  let fingerSeen = 0; // clock time of the last touch event
  // momentum: after a finger lifts, the spot it let go of rides on with the page while it keeps scrolling
  let mom: { x: number; y: number; sy: number; t: number; still: number } | null = null;
  let lastScroll = NaN; // read in the first frame, not at start-up (it could force a layout into the loading task)
  let down: { x: number; y: number; t: number; id: number } | null = null;
  const taps: { x: number; y: number; touch: boolean }[] = [];
  const bursts: Burst[] = [];
  const recent: SourceRec[] = [];
  let live: number[] = []; // clock times of input events that made waves (the canvas' data-live)
  let lastUser = -9; // clock time of the last wave the visitor made

  const now = () => (typeof performance === 'undefined' ? clock.t : Math.max(clock.t, performance.now() / 1000));

  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return; // fingers: touch events (they keep coming during a native pan)
    mouseIn = true;
    buttons = e.buttons;
    const list = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    if (list.length > 1) for (const c of list) mouse.pts.push(c.pageX, c.pageY);
    else mouse.pts.push(e.pageX, e.pageY);
    mouse.cx = e.clientX;
    mouse.cy = e.clientY;
  };
  const onTouch = (e: TouchEvent) => {
    const tc = e.touches[0];
    if (!tc) return;
    if (e.type === 'touchstart' || !fingerDown) {
      fingerDown = true;
      mom = null;
      wake.end(finger.st); // a new touch never draws a line from where the last one ended
      finger.lx = NaN;
      finger.pts.length = 0;
    } else finger.pts.push(tc.clientX, tc.clientY);
    finger.cx = tc.clientX;
    finger.cy = tc.clientY;
    fingerSeen = clock.t;
  };
  const onTouchEnd = (e: TouchEvent) => {
    if (e.touches.length || !fingerDown) return;
    fingerDown = false;
    // the spot the finger let go of rides on with the page (momentum) from where its trail ended
    mom = Number.isNaN(finger.lx) ? null : { x: finger.lx, y: finger.ly, sy: scrollY, t: clock.t, still: 0 };
    if (!mom) wake.end(finger.st);
  };
  const onDown = (e: PointerEvent) => {
    down = { x: e.pageX, y: e.pageY, t: now(), id: e.pointerId };
    if (e.pointerType !== 'touch') buttons = e.buttons;
  };
  // A tap is one drop, made when the pointer comes up where it went down. Anything that travelled already made its wake.
  const onUp = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') buttons = e.buttons;
    const d = down;
    down = null;
    // (a pointercancel on touch is the browser taking over the pan: the finger is still down, touchmove goes on)
    if (e.type !== 'pointerup' || !d || d.id !== e.pointerId) return;
    if (Math.hypot(e.pageX - d.x, e.pageY - d.y) <= TAP_PX && (now() - d.t) * 1000 < TAP_MS) taps.push({ x: e.pageX, y: e.pageY, touch: e.pointerType === 'touch' });
  };
  const onLeave = () => {
    mouseIn = false;
    mouse.lx = NaN;
    mouse.pts.length = 0;
    wake.end(mouse.st);
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

  const sigma = { s: 10.4 }; // px: a drop's kernel
  /** A ringing drop at page px (x, y): `a` = its total strength (velocity kicks summed over its life, px). */
  function burst(x: number, y: number, a: number, t0: number, len = TUNE.dropLen, tau = TUNE.dropTau, s = sigma.s, user = true) {
    if (user) lastUser = Math.max(lastUser, t0);
    // normalise so `a` is the drop's total (the ringing envelope integrates to about tau)
    bursts.push({ x, y, a: a / tau, t0, len, tau, s, w: 2 * Math.PI * TUNE.osc });
  }

  /**
   * One pointer's path since the last frame, in its stroke's frame (x1, y1: where it is now; `extra` the events' points
   * on the way). Its wake gets the path; `k` is its strength relative to a hovering cursor; ox / oy turn the frame's
   * px into page px (records, 3D notifications).
   */
  function trace(P: Ptr, x1: number, y1: number, dt: number, t: number, k: number, kind: Kind, ox: number, oy: number) {
    if (Number.isNaN(P.lx)) {
      P.lx = x1;
      P.ly = y1;
      P.pts.length = 0;
      P.speed = 0;
      P.rem = TUNE.gap * 0.5;
      wake.end(P.st);
      return;
    }
    const path = [P.lx, P.ly];
    for (let i = 0; i < P.pts.length; i += 2) path.push(P.pts[i], P.pts[i + 1]);
    path.push(x1, y1);
    P.pts.length = 0;
    let L = 0;
    for (let i = 2; i < path.length; i += 2) L += Math.hypot(path[i] - path[i - 2], path[i + 1] - path[i - 1]);
    P.lx = x1;
    P.ly = y1;
    // a jump (anchor link, restored scroll, a pointer that left and came back): no wave across the page
    if (L > Math.max(600, 6000 * dt)) {
      P.speed = 0;
      wake.end(P.st);
      return;
    }
    const inst = L / Math.max(dt, 1 / 240);
    P.speed += (inst - P.speed) * (1 - Math.exp(-dt / (P.st.fr ? 0.08 : 0.045)));
    const a = TUNE.amp * strength(P.speed) * k;
    wake.move(P.st, path, t - dt, t, P.speed, a);
    if (L < 0.5 || a <= 0) return;
    lastUser = t;
    live.push(t);
    // record where it went: a point every `gap` px of path, or every `every` s while it moves slowly
    let s = 0;
    let next = P.rem;
    for (let i = 2; i < path.length; i += 2) {
      const ax = path[i - 2];
      const ay = path[i - 1];
      const l = Math.hypot(path[i] - ax, path[i + 1] - ay);
      while (next <= s + l) {
        const u = l ? (next - s) / l : 1;
        const tt = t - dt + (dt * next) / L;
        record(ax + (path[i] - ax) * u + ox, ay + (path[i + 1] - ay) * u + oy, a, kind, tt);
        P.lastRec = tt;
        next += TUNE.gap;
      }
      s += l;
    }
    P.rem = next - s;
    if (t - P.lastRec >= TUNE.every) {
      record(x1 + ox, y1 + oy, a, kind, t);
      P.lastRec = t;
      P.rem = TUNE.gap;
    }
    P.agg += L;
    if (P.agg >= 40 || t - P.aggT > 0.08) {
      P.agg = 0;
      P.aggT = t;
      notify(x1 + ox, y1 + oy, 0.2 + 0.25 * Math.min(1.5, strength(P.speed)), 20);
    }
  }

  /** A floating thing's ripple (or the pour landing): a drop of total strength `a` (px of velocity kicks). */
  function drop(x: number, y: number, a: number) {
    burst(x, y, a, clock.t, TUNE.dropLen * 1.3, TUNE.dropTau * 1.2, sigma.s, false);
    record(x, y, a, 'float', clock.t);
  }

  /** This frame's drops for the grid (sorted by when in the frame), for `sim.advance(dt, stamps)`; the pointers' wakes
   *  are updated on the way. */
  function stamps(dt: number, cell: number): Stamp[] {
    const t = clock.t;
    sigma.s = cell * 1.3;
    const sx = scrollX;
    const sy = scrollY;
    const dsy = Number.isNaN(lastScroll) ? 0 : sy - lastScroll;
    const scrolled = Math.abs(dsy) > 0.25;
    lastScroll = sy;
    for (const tp of taps) {
      const a = TUNE.rate * TUNE.tapK * (tp.touch ? 1.1 : 1);
      burst(tp.x, tp.y, a, t - dt, TUNE.tapLen, TUNE.tapTau, sigma.s * 1.15);
      record(tp.x, tp.y, a, 'tap', t);
      live.push(t);
      notify(tp.x, tp.y, tp.touch ? 2.1 : 1.9, 24);
    }
    taps.length = 0;
    if (mouseIn) {
      // the page moving past a cursor that rests on the glass: the same wake, along its path through the page
      const still = Math.hypot(mouse.cx - mouse.lcx0, mouse.cy - mouse.lcy0) < 1;
      mouse.lcx0 = mouse.cx;
      mouse.lcy0 = mouse.cy;
      const byScroll = scrolled && still;
      trace(mouse, mouse.cx + sx, mouse.cy + sy, dt, t, buttons ? TUNE.drag : byScroll ? TUNE.scroll : 1, byScroll ? 'scroll' : 'move', 0, 0);
    }
    if (fingerDown) {
      // a finger whose touch the browser ended without telling us (no touchend) times out
      if (t - fingerSeen > 1.5 && !scrolled) {
        fingerDown = false;
        wake.end(finger.st);
      } else trace(finger, finger.cx, finger.cy, dt, t, TUNE.drag, 'touch', sx, sy);
    } else if (mom) {
      const m = mom;
      m.still = scrolled ? 0 : m.still + dt;
      const y = m.y - (sy - m.sy);
      if (m.still > 0.25 || t - m.t > 4 || y < -80 || y > innerHeight + 80) {
        mom = null;
        wake.end(finger.st);
      } else trace(finger, m.x, y, dt, t, TUNE.momentum, 'touch', sx, sy);
    }
    // every live drop rings: 4 samples per frame (smooth at 120 Hz substeps), each with its moment in the frame
    const out: Stamp[] = [];
    const J = 4;
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      for (let j = 0; j < J; j++) {
        const f = (j + 0.5) / J;
        const tau = t - dt + f * dt - b.t0;
        if (tau < 0 || tau > b.len) continue;
        const env = Math.exp(-tau / b.tau) * (1 - tau / b.len);
        out.push({ x: b.x, y: b.y, a: (b.a * env * Math.cos(b.w * tau) * dt) / J, s: b.s, f });
      }
      if (t - b.t0 > b.len) bursts.splice(i, 1);
    }
    out.sort((a, b) => a.f - b.f);
    return out;
  }

  /** The wakes' live heads (for `wake.addTo`). */
  const heads = () => [mouse.st, finger.st];

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

  return { stamps, drop, liveCount, sources, record, unbind, wake, heads, lastUser: () => lastUser };
}
