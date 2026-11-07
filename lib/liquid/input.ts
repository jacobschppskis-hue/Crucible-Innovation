// What makes waves: the pointer's path, taps, finger drags, scrolling past a resting cursor or finger, and ripples shed by
// floating things. Events only record where the pointer went; once per frame that becomes impulses for the wave grid.
//
// A moving pointer is a small vibrating source that travels with it (a fingertip trembling on the surface): one
// oscillation at `osc` Hz on the clock's own phase, stamped along the path at every substep, its strength following the
// pointer's speed (quick to start, a short ring-out when it stops). Because the phase is one continuous oscillation,
// every new crest is born right AT the pointer and lines up with the ones before it: rings around a slow pointer
// (squeezed ahead, stretched behind), a V of crests behind one faster than the waves. The ripple train then spreads and
// fades behind it. The oscillation has no mean, so a fast path never leaves a trough. (v2r1 left separate drops every
// 24 px, each ringing from its own start: at sweep speed their phases fell a third of a period apart and cancelled near
// the pointer, so the wake only lined up 50-150 px behind it.) A tap is one bigger ringing drop.
//
// Touch: a finger that pans the page moves WITH the page, so in page space it barely moves; its source sits at the spot
// it touches and sings by how fast it moves on the glass. `touchmove` (passive) keeps arriving during a native pan,
// unlike pointer events (the browser cancels those). After the finger lifts, its last position on the glass acts like a
// resting cursor while the page keeps scrolling (momentum), and the page's motion past it makes the scroll wake.

import { clock } from './loop';
import { HZ, SIM, type Stamp } from './sim';

/** Tunables (the look lab overrides them). osc: ripple frequency (Hz; wavelength = wave speed / osc). rate: a moving
 *  pointer's strength at 400 px/s (velocity kicks, px of height per second, at the crest of the oscillation); up /
 *  down: how fast it starts and how long it rings out after the pointer stops (s). mach: speeds (in wave speeds) over
 *  which it hands over to drops along the path (dropK: their strength relative to `rate`). gap / every: px of path or s
 *  between drops and recorded sources (`__liquid.sources()`). drop / tap: how long a drop rings (s) and its decay (s); tapK: a tap's total
 *  strength relative to one second of `rate`. */
export const TUNE = { osc: 8.5, rate: 70, size: 1.8, up: 0.03, down: 0.12, mach: [1.6, 3], dropK: 2.2, gap: 24, every: 0.1, dropLen: 0.24, dropTau: 0.07, tapK: 0.9, tapLen: 0.5, tapTau: 0.14 };
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
  speed: number; // px/s, smoothed (a finger: the faster of its page path and its motion on the glass)
  pspeed: number; // px/s along the page path, smoothed
  rem: number; // px of path until the next recorded source
  lastDrop: number; // clock time of the last recorded source
  a: number; // the moving source's strength now (eased towards the pointer's)
  agg: number; // px of path since the last notification (interim 3D sources)
  aggT: number;
};

const fresh = (): Ptr => ({ cx: 0, cy: 0, lx: NaN, ly: NaN, lcx: 0, lcy: 0, lcx0: 0, lcy0: 0, pts: [], speed: 0, pspeed: 0, rem: 0, lastDrop: -9, a: 0, agg: 0, aggT: 0 });

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
  const sung: Stamp[] = []; // this frame's impulses from the moving sources
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

  const sigma = { s: 10.4, m: 10.4 }; // px: a drop's kernel, the moving source's
  /** A ringing drop at page px (x, y): `a` = its total strength (velocity kicks summed over its life, px). */
  function burst(x: number, y: number, a: number, t0: number, len = TUNE.dropLen, tau = TUNE.dropTau, s = sigma.s, user = true) {
    if (user) lastUser = Math.max(lastUser, t0);
    // normalise so `a` is the drop's total (the ringing envelope integrates to about tau)
    bursts.push({ x, y, a: a / tau, t0, len, tau, s });
  }

  /** Walk one pointer's path since the last frame: its source sings along it, and the path is recorded. */
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
      P.pspeed = 0;
      P.a = 0;
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
    P.pspeed += (L / Math.max(dt, 1 / 240) - P.pspeed) * 0.5;
    // a jump (anchor link, restored scroll, a pointer that left and came back): no wave across the page
    if (L > Math.max(600, 6000 * dt)) {
      P.a = 0;
      P.pspeed = 0;
      return;
    }
    const fs = strength(P.speed);
    // the page moving past a pointer that rests on the glass: the scroll wake
    const still = Math.hypot(P.cx - P.lcx0, P.cy - P.lcy0) < 1;
    const byScroll = scrolled && still && L > 0.5;
    const kind: Kind = byScroll ? 'scroll' : touch ? 'touch' : 'move';
    const moving = fs > 0 && L > 0.5;
    // a finger panning the page sings at the spot it holds, by its speed on the glass
    const pan = touch && fs > 0 ? Lc - L : 0;
    const k = TUNE.rate * fs * Math.max(moving ? (byScroll ? K_SCROLL : 1) : 0, pan > 1.5 ? K_PAN : 0);
    // Faster than the waves (a flick) the source hands over to drops: each spot of the path rings from the moment the
    // pointer passed it, so the drops' rings line up into the two smooth arms of a V, each a short ripple train. (The
    // oscillator alone would alternate its sign every half period along a fast path: beads, not arms.)
    const m = moving ? Math.min(1, Math.max(0, (P.pspeed / SIM.speed - TUNE.mach[0]) / (TUNE.mach[1] - TUNE.mach[0]))) : 0;
    const wd = m * m * (3 - 2 * m);
    sing(P, path, L, dt, t, k * (1 - wd));
    if (k > 0) lastUser = t;
    if (pan > 1.5 && t - P.lastDrop >= TUNE.every * 0.6) {
      record(x1, y1, k, 'touch', t);
      P.lastDrop = t;
      live.push(t);
      coarse(P, x1, y1, pan, fs, t);
    }
    if (!moving) return;
    // record where the source went: a point every `gap` px of path, or every `every` s while it moves slowly
    let s = 0;
    let next = P.rem;
    const t0 = t - dt;
    for (let i = 2; i < path.length; i += 2) {
      const ax = path[i - 2];
      const ay = path[i - 1];
      const l = Math.hypot(path[i] - ax, path[i + 1] - ay);
      while (next <= s + l) {
        const u = l ? (next - s) / l : 1;
        const tt = t0 + (dt * next) / L;
        const x = ax + (path[i] - ax) * u;
        const y = ay + (path[i + 1] - ay) * u;
        if (wd > 0) burst(x, y, k * TUNE.dropK * wd * Math.min(0.1, Math.max(1 / 240, tt - P.lastDrop)), tt);
        record(x, y, k, kind, tt);
        P.lastDrop = tt;
        next += TUNE.gap;
      }
      s += l;
    }
    P.rem = next - s;
    if (t - P.lastDrop >= TUNE.every) {
      record(x1, y1, k, kind, t);
      P.lastDrop = t;
      P.rem = TUNE.gap;
    }
    live.push(t);
    coarse(P, x1, y1, L, fs, t);
  }

  /** The moving source: its strength eases towards `k` (quick up, a short ring-out when the pointer stops) and it
   *  oscillates on the clock's own phase, stamped at evenly spaced moments of the frame (at least one per substep, and
   *  close enough along the path to stay one smooth stroke), each where the pointer was at that moment. */
  function sing(P: Ptr, path: number[], L: number, dt: number, t: number, k: number) {
    const a0 = P.a;
    const a1 = k + (a0 - k) * Math.exp(-dt / (k > a0 ? TUNE.up : TUNE.down));
    P.a = a1 < TUNE.rate * 0.002 ? 0 : a1;
    if (a0 <= 0 && P.a <= 0) return;
    const n = Math.min(64, Math.max(1, Math.ceil(dt * HZ - 1e-6), Math.ceil(L / (sigma.m * 0.5))));
    const w = 2 * Math.PI * TUNE.osc;
    let i = 2;
    let s0 = 0; // path length at the start of segment i
    let l = Math.hypot(path[2] - path[0], path[3] - path[1]);
    for (let j = 0; j < n; j++) {
      const f = (j + 0.5) / n;
      const d = f * L;
      while (i < path.length - 2 && s0 + l < d) {
        s0 += l;
        i += 2;
        l = Math.hypot(path[i] - path[i - 2], path[i + 1] - path[i - 1]);
      }
      const u = l > 0 ? Math.min(1, Math.max(0, (d - s0) / l)) : 1;
      const tt = t - dt + f * dt;
      sung.push({
        x: path[i - 2] + (path[i] - path[i - 2]) * u,
        y: path[i - 1] + (path[i + 1] - path[i - 1]) * u,
        a: ((a0 + (a1 - a0) * f) * Math.cos(w * tt) * dt) / n,
        s: sigma.m,
        f,
      });
    }
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
    sigma.m = cell * TUNE.size;
    const sy = scrollY;
    const scrolled = !Number.isNaN(lastScroll) && Math.abs(sy - lastScroll) > 0.25;
    lastScroll = sy;
    sung.length = 0;
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
    const out: Stamp[] = sung.slice();
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
