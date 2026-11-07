// Floating: DOM things ride the liquid like buoys. Each visible floater feels the surface under its whole box (a few
// points across it: mean height, the tilt of the best plane through them, mean slope; see `footprint` in field.ts),
// and follows it through a second-order spring per axis (damping ~0.75 of critical): it bobs with the height, rocks
// with the tilt and drifts a little down the slope, always back towards where it belongs. No dead band, no hard clamps
// (a soft tanh limit only on large waves), so motion is continuous: no stick, no slip.
//
// Text, headings and blocks ride the whole surface (grid + idle swell), so they are never quite still. Controls (links,
// buttons) ride only the interaction waves and come to an exact rest (styles cleared) once those calm down, so a click
// always lands where the button is. One writer per element: the magnetic lean (lean.ts) is added here for the
// elements floating owns. Applied with the individual `translate` / `rotate` properties so `transform` reveals keep
// working; layout never changes. Loads with the liquid, never in the first-load JS. Off with reduced motion.

import { activity, addSource, footprint, textMask, type Footprint } from './field';
import { leanOf, own } from './lean';
import { clock, onFrame } from './loop';

const clockT = () => clock.t;

export type FloatLevel = 'strong' | 'heading' | 'block' | 'text';
type Level = FloatLevel | 'control';

/** Per level: soft maxima y (bob, px), x (drift, px), r (tilt, deg); spring f (Hz) and damping ratio; swell = rides the
 *  idle swell (else only interaction waves); ripple = sheds a small ripple when rocked hard. Strongest first. */
export const LEVELS: Record<Level, { y: number; x: number; r: number; f: number; zeta: number; swell: boolean; ripple: boolean }> = {
  strong: { y: 9, x: 4.5, r: 2.2, f: 0.8, zeta: 0.7, swell: true, ripple: true },
  heading: { y: 4.2, x: 2.2, r: 0.85, f: 0.9, zeta: 0.72, swell: true, ripple: true },
  block: { y: 3.2, x: 1.6, r: 0.6, f: 1.0, zeta: 0.75, swell: true, ripple: true },
  text: { y: 1.25, x: 0.6, r: 0.22, f: 1.2, zeta: 0.78, swell: true, ripple: false },
  control: { y: 1.2, x: 0.6, r: 0.25, f: 1.6, zeta: 0.8, swell: false, ripple: false },
};

// Surface -> offset: the input is divided by these before the soft limit (tanh), so a wave of this size moves a thing to
// about 76% of its level's maximum. Controls follow interaction waves only while the visitor is interacting: their pull
// fades out smoothly between CTRL_HOLD and CTRL_FADE s after the last input, so they are at exact rest ~1.4 s after it
// (a click lands where the button is drawn), whatever ripples are still crossing under them.
const CTRL_HOLD = 0.35;
const CTRL_FADE = 0.85;
const H0 = 7; // px of height
const S0 = 0.05; // slope
const GATE = 0.12; // controls: inputs well below this (relative) fade out smoothly (cubic), so tiny leftovers never move them

// (3D things use lib/liquid/buoy.ts: the same springs on a footprint, with tilt on both axes.)

type L3 = (typeof LEVELS)[Level];
const T3 = { x: 0, y: 0, r: 0 };
function targets(fp: Footprint, L: L3, gate: boolean, calm: number) {
  let y = -fp.h / H0;
  let x = -fp.gx / S0;
  let r = -fp.roll / S0;
  if (gate) {
    y *= (y * y) / (y * y + GATE * GATE);
    x *= (x * x) / (x * x + GATE * GATE);
    r *= (r * r) / (r * r + GATE * GATE);
  }
  // a wave rolling the box tilts it: the side the surface lifts goes up (negative rotate lifts the right end)
  T3.y = L.y * Math.tanh(y) * calm;
  T3.x = L.x * Math.tanh(x) * calm;
  T3.r = L.r * Math.tanh(r) * calm;
  return T3;
}

function spring3(L: L3) {
  const w = 2 * Math.PI * L.f;
  const z = L.zeta;
  const st = { x: 0, y: 0, r: 0, vx: 0, vy: 0, vr: 0 };
  return {
    st,
    step(tg: { x: number; y: number; r: number }, dt: number) {
      const n = Math.max(1, Math.ceil(dt / 0.008));
      const h = Math.min(dt, 0.1) / n;
      for (let i = 0; i < n; i++) {
        st.vx += (w * w * (tg.x - st.x) - 2 * z * w * st.vx) * h;
        st.vy += (w * w * (tg.y - st.y) - 2 * z * w * st.vy) * h;
        st.vr += (w * w * (tg.r - st.r) - 2 * z * w * st.vr) * h;
        st.x += st.vx * h;
        st.y += st.vy * h;
        st.r += st.vr * h;
      }
      return st;
    },
  };
}

type F = {
  el: HTMLElement;
  level: Level;
  L: L3;
  s: ReturnType<typeof spring3>;
  x: number; // page px of the box, offsets removed
  y: number;
  w: number;
  h: number;
  ox: number; // last written
  oy: number;
  or: number;
  moving: boolean; // inside a pinned (sticky) or scroll-driven scene: re-measured every frame
  dirty: boolean;
  rest: boolean; // controls: at exact rest, styles cleared
  ripT: number;
  mask: number; // 0: not part of the text mask
  write: boolean; // false: mask only (never moved)
};

const AUTO = 'h1, h2, .h-display, .h-section, main p, main li, main a, main button, [data-float]';
const CONTAINS = 'h1, h2, .h-display, .h-section, p, li, [data-float]:not([data-float="none"])';
const MASK_ONLY = 'footer p, footer li, footer a, main h3, main h4, main dt, main dd, main .label, main blockquote';
const SKIP = '.nav, nav, header, form, dialog, [role="dialog"], [data-float="none"], [data-floated-off]';
const FIELD = 'input, textarea, select, [contenteditable="true"]';

export function startFloat(): () => void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};

  const all = new Map<HTMLElement, F>();
  const visible = new Set<F>();
  let calm = 1; // eased 1 -> 0 while a form field has focus: nothing moves while someone types
  let calmTo = 1;
  let ripAll = -9;
  const fp: Footprint = { h: 0, gx: 0, gy: 0, roll: 0, pitch: 0 };

  const io = new IntersectionObserver(
    (es) => {
      for (const e of es) {
        const f = all.get(e.target as HTMLElement);
        if (!f) continue;
        if (e.isIntersecting) {
          // its box as the browser measured it while rendering (no layout forced here); our offsets are 0 while hidden
          const r = e.boundingClientRect;
          const ln = f.write ? leanOf(f.el) : null;
          f.x = r.left + scrollX - (ln?.x ?? 0);
          f.y = r.top + scrollY - (ln?.y ?? 0);
          f.w = r.width;
          f.h = r.height;
          f.dirty = false;
          visible.add(f);
        } else {
          visible.delete(f);
          clear(f);
        }
        maskDirty = true;
      }
    },
    { rootMargin: '120px 0px' },
  );

  function levelOf(el: HTMLElement): Level | null {
    const d = el.dataset.float;
    if (d === 'none') return null;
    if (d === 'strong' || d === 'heading' || d === 'block' || d === 'text') return d;
    if (el.matches('h1, h2, .h-display, .h-section')) return 'heading';
    if (el.matches('a, button')) return 'control';
    return 'text';
  }

  // Finding the floaters is done in small slices when the main thread is idle (never one long task at start-up): the
  // candidates are queued in document order (ancestors first) and checked a few dozen at a time.
  const queue: HTMLElement[] = [];
  const queued = new Set<HTMLElement>();
  let slice = 0;
  type Deadline = { timeRemaining(): number; didTimeout?: boolean };
  const idle = (fn: (d?: Deadline) => void) => {
    const ric = (window as unknown as { requestIdleCallback?: (f: (d: Deadline) => void, o?: { timeout: number }) => number }).requestIdleCallback;
    return ric ? ric(fn, { timeout: 500 }) : window.setTimeout(fn, 16);
  };

  function scan() {
    for (const f of [...all.values()]) {
      if (!f.el.isConnected) {
        io.unobserve(f.el);
        visible.delete(f);
        all.delete(f.el);
        if (f.write) own(f.el, false);
      }
    }
    for (const el of document.querySelectorAll<HTMLElement>(AUTO + ', ' + MASK_ONLY)) {
      if (all.has(el) || queued.has(el)) continue;
      queued.add(el);
      queue.push(el);
    }
    if (queue.length && !slice) slice = idle(take);
  }

  function take(d?: Deadline) {
    slice = 0;
    // a few at a time while the idle period lasts (each check reads computed style), at least two
    let n = 0;
    while (n < queue.length && n < 24 && (n < 2 || !d || d.timeRemaining() > 3)) n++;
    const batch = queue.splice(0, n);
    // reads first (computed styles), then writes (data-fl, observe)
    const found: [HTMLElement, Level, boolean][] = [];
    for (const el of batch) {
      queued.delete(el);
      if (!el.isConnected || all.has(el) || el.closest(SKIP)) continue;
      const auto = el.matches(AUTO);
      if (!auto) {
        found.push([el, 'text', false]); // mask only
        continue;
      }
      const lv = levelOf(el);
      if (!lv || el.querySelector('form')) continue;
      if (!el.closest('main') && !el.dataset.float) continue; // auto levels live in main
      // a container of headings, paragraphs, list items or an explicit floater (a portrait in a list item, a caption with
      // its heading) lets its contents float instead, each at its own level
      if (!el.dataset.float && el.querySelector(CONTAINS)) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'inline' || cs.display === 'contents' || cs.position === 'fixed') continue; // translate needs a box
      found.push([el, lv, true]);
    }
    for (const [el, lv, wr] of found) {
      if (wr && el.parentElement?.closest('[data-fl], [data-fl-c]')) continue; // an ancestor already floats: one writer
      if (wr) {
        // controls rest at idle (they ride interaction waves only), so they are marked apart from the things that rock
        el.setAttribute(lv === 'control' ? 'data-fl-c' : 'data-fl', '');
        own(el, true);
      }
      const L = LEVELS[lv];
      const f: F = { el, level: lv, L, s: spring3(L), x: NaN, y: NaN, w: 0, h: 0, ox: 0, oy: 0, or: 0, moving: false, dirty: true, rest: lv === 'control', ripT: -9, mask: lv === 'heading' ? 150 : 255, write: wr };
      all.set(el, f);
      io.observe(el);
    }
    if (queue.length) slice = idle(take);
  }

  // The box without our own offsets: the layout size (a rotated box's bounding rect would change every frame) around
  // the rect's centre (which rotation about the centre leaves in place), minus the offset and lean written last frame.
  // A change that moves the box by half a pixel or more is a new mask (glints behind text are capped there).
  let maskDirty = true;
  function measure(f: F) {
    const r = f.el.getBoundingClientRect();
    const ln = f.write ? leanOf(f.el) : null;
    const w = f.el.offsetWidth || r.width;
    const h = f.el.offsetHeight || r.height;
    const x = (r.left + r.right) / 2 - w / 2 + scrollX - f.ox - (ln?.x ?? 0);
    const y = (r.top + r.bottom) / 2 - h / 2 + scrollY - f.oy - (ln?.y ?? 0);
    if (f.mask && !(Math.abs(x - f.x) <= 0.5 && Math.abs(y - f.y) <= 0.5 && Math.abs(w - f.w) <= 0.5 && Math.abs(h - f.h) <= 0.5)) maskDirty = true;
    // a box whose page position changes while the page scrolls rides a pinned or scroll-driven scene: from now on it is
    // re-measured every frame while scrolling (no style walks to find out)
    if (!f.moving && !f.dirty && clock.t - scrolledAt < 0.8 && (Math.abs(x - f.x) > 1 || Math.abs(y - f.y) > 1)) f.moving = true;
    f.x = x;
    f.y = y;
    f.w = w;
    f.h = h;
    f.dirty = false;
  }

  function clear(f: F) {
    if (!f.write) return;
    f.el.style.translate = '';
    f.el.style.rotate = '';
    f.ox = f.oy = f.or = 0;
    const st = f.s.st;
    st.x = st.y = st.r = st.vx = st.vy = st.vr = 0;
    f.rest = f.level === 'control';
  }

  // re-measure everything after layout changes: resize, fonts, lazy content, the scroll settling (sticky scenes end)
  let allDirty = false;
  let settleT = 0;
  const flagAll = () => {
    allDirty = true;
  };
  let scrolledAt = -9;
  const onScroll = () => {
    scrolledAt = clockT();
    clearTimeout(settleT);
    settleT = window.setTimeout(flagAll, 160);
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', flagAll);
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(flagAll) : null;
  ro?.observe(document.body);

  const focusIn = (e: Event) => {
    if ((e.target as Element)?.matches?.(FIELD)) calmTo = 0;
  };
  const focusOut = () => setTimeout(() => (calmTo = document.activeElement?.matches?.(FIELD) ? 0 : 1));
  document.addEventListener('focusin', focusIn);
  document.addEventListener('focusout', focusOut);

  let moT = 0;
  const mo = new MutationObserver(() => {
    clearTimeout(moT);
    moT = window.setTimeout(() => {
      scan();
      allDirty = true;
    }, 400);
  });
  mo.observe(document.body, { childList: true, subtree: true });
  scan();

  // layout reads, before anything writes this frame
  let tick = 0;
  const offEarly = onFrame((t) => {
    tick++;
    if (allDirty) {
      allDirty = false;
      for (const f of visible) f.dirty = true;
    }
    // boxes in pinned scenes move only while the page scrolls (and while scroll-driven scenes ease after it)
    const scrolling = t - scrolledAt < 0.8;
    let k = 0;
    let dirtyLeft = 12; // a layout change re-measures everything, a dozen boxes a frame (never one long frame)
    for (const f of visible) {
      // the moving ones every frame while scrolling, dirty ones a few a frame, every box again about once a second
      if ((f.moving && scrolling) || (f.dirty && dirtyLeft-- > 0) || (k++ + tick) % 60 === 0) measure(f);
    }
  }, { early: true });

  const mask: number[] = [];
  const offFrame = onFrame((t, dt) => {
    calm += (calmTo - calm) * Math.min(1, dt * 4);
    if (calmTo === 0 && calm < 0.002) calm = 0;
    mask.length = 0;
    const since = t - activity.last;
    const u = Math.min(1, Math.max(0, (since - CTRL_HOLD) / (CTRL_FADE - CTRL_HOLD)));
    const ctrl = 1 - u * u * (3 - 2 * u);
    for (const f of visible) {
      if (Number.isNaN(f.x)) continue; // not measured yet
      if (f.mask) mask.push(f.x, f.y, f.w, f.h, f.mask);
      if (!f.write) continue;
      const L = f.L;
      footprint(f.x, f.y, f.w, f.h, { swell: L.swell, t }, fp);
      const tg = targets(fp, L, f.level === 'control', f.level === 'control' ? calm * ctrl : calm);
      const ln = leanOf(f.el);
      const lx = ln?.x ?? 0;
      const ly = ln?.y ?? 0;
      if (calm === 0) {
        // someone is typing: everything comes to rest and stays there
        const st = f.s.st;
        if (Math.abs(st.x) + Math.abs(st.y) < 0.02 && Math.abs(st.r) < 0.003 && !lx && !ly) {
          if (f.ox || f.oy || f.or) clear(f);
          continue;
        }
      }
      if (f.rest) {
        // at exact rest: wake only for a real wave (or a lean)
        if (Math.abs(tg.x) < 0.02 && Math.abs(tg.y) < 0.02 && Math.abs(tg.r) < 0.003 && !lx && !ly) continue;
        f.rest = false;
      }
      const s = f.s.step(tg, dt);
      if (f.level === 'control' && !lx && !ly) {
        const still = Math.abs(s.x) < 0.02 && Math.abs(s.y) < 0.02 && Math.abs(s.r) < 0.003 && Math.abs(s.vx) + Math.abs(s.vy) < 0.1 && Math.abs(s.vr) < 0.01;
        if (still && Math.abs(tg.x) < 0.02 && Math.abs(tg.y) < 0.02 && Math.abs(tg.r) < 0.003) {
          clear(f);
          f.rest = true;
          continue;
        }
      }
      const dx = s.x + lx;
      const dy = s.y + ly;
      const dr = s.r;
      // write only a visible change (slow idle rocking then writes every few frames, fast motion every frame)
      if (Math.abs(dx - f.ox) < 0.03 && Math.abs(dy - f.oy) < 0.03 && Math.abs(dr - f.or) < 0.003) continue;
      f.ox = dx;
      f.oy = dy;
      f.or = dr;
      f.el.style.translate = `${dx.toFixed(3)}px ${dy.toFixed(3)}px`;
      f.el.style.rotate = `${dr.toFixed(4)}deg`;
      // rocked hard: a small ripple at its waterline (rare, own budget; the field never feeds it back to its source)
      if (L.ripple && Math.abs(s.vy) + Math.abs(s.vx) > 16 && t - f.ripT > 3 && t - ripAll > 0.8) {
        f.ripT = ripAll = t;
        addSource(f.x + f.w / 2, f.y + f.h + 6, 0.12, 9, { kind: 'float' });
      }
    }
    if (maskDirty || mask.length !== textMask.rects.length) {
      maskDirty = false;
      textMask.rects = mask.slice();
      textMask.version++;
    }
  });

  const api = {
    list: () => [...visible].filter((f) => f.write).map((f) => ({ el: f.el, level: f.level, dx: f.ox, dy: f.oy, rot: f.or, rest: f.rest })),
  };
  (window as unknown as { __float?: typeof api }).__float = api;

  return () => {
    offEarly();
    offFrame();
    io.disconnect();
    mo.disconnect();
    ro?.disconnect();
    removeEventListener('scroll', onScroll);
    removeEventListener('resize', flagAll);
    document.removeEventListener('focusin', focusIn);
    document.removeEventListener('focusout', focusOut);
    textMask.rects = [];
    textMask.version++;
    for (const f of all.values()) {
      clear(f);
      if (f.write) {
        f.el.removeAttribute('data-fl');
        f.el.removeAttribute('data-fl-c');
        own(f.el, false);
      }
    }
    delete (window as unknown as { __float?: unknown }).__float;
  };
}
