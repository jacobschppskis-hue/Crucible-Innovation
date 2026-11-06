// Floating: DOM things ride the liquid like buoys. Each visible floater samples the wave under its centre (page
// coords), bobs with the height, tilts with the slope and drifts a little with it, through a spring-damper that
// follows the wave (offsets are a function of the wave, never cumulative, so things always come back).
// Applied with the individual `translate` / `rotate` properties so `transform` reveals keep working; layout never
// changes. Loads with the liquid, not in the first-load JS.
import { onFrame } from './loop';
import { addSource, sample } from './field';

export type FloatLevel = 'strong' | 'heading' | 'block' | 'text';

/** Per level: y = px of bob, x = px of drift, r = degrees of tilt (soft maxima), ripple = may emit small ripples. */
export const LEVELS: Record<FloatLevel, { y: number; x: number; r: number; ripple: boolean }> = {
  strong: { y: 14, x: 9, r: 5, ripple: true },
  heading: { y: 8, x: 5, r: 2.2, ripple: true },
  block: { y: 5.5, x: 3.2, r: 1.3, ripple: true },
  text: { y: 1.6, x: 1, r: 0.3, ripple: false },
};

// Raw wave -> soft-saturated offset: gain chosen so a light pointer wave (h ~0.3, slope ~0.03/px) reads clearly.
const GAIN_Y = 3; // x level.y per unit of h
const GAIN_X = 90; // per unit of slope (px/px)
const GAIN_R = 90; // ditto, degrees
const sat = (v: number) => Math.tanh(v);

const OMEGA = 9; // spring rad/s
const ZETA = 0.62; // damping ratio: a little overshoot, buoy-like

/** Reusable buoy physics for the 3D scenes: `step(x, docY, dt) -> {dx, dy, tilt}` (px, px, degrees). */
export function buoy(opts: { strength?: number | FloatLevel } = {}) {
  const lv = typeof opts.strength === 'string' ? LEVELS[opts.strength] : null;
  const k = typeof opts.strength === 'number' ? opts.strength : 1;
  const L = lv ?? { y: LEVELS.strong.y * k, x: LEVELS.strong.x * k, r: LEVELS.strong.r * k };
  let x = 0, y = 0, r = 0, vx = 0, vy = 0, vr = 0;
  const out = { dx: 0, dy: 0, tilt: 0, vy: 0 };
  return {
    step(px: number, docY: number, dt: number, calm = 1) {
      const s = sample(px, docY);
      const ty = -sat(s.h * GAIN_Y) * L.y * calm;
      const tx = sat(s.gx * GAIN_X) * L.x * calm;
      const tr = -sat(s.gx * GAIN_R) * L.r * calm;
      // sub-step so a long frame cannot blow the integrator up
      const n = Math.ceil(dt / 0.012);
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        vx += (OMEGA * OMEGA * (tx - x) - 2 * ZETA * OMEGA * vx) * h; x += vx * h;
        vy += (OMEGA * OMEGA * (ty - y) - 2 * ZETA * OMEGA * vy) * h; y += vy * h;
        vr += (OMEGA * OMEGA * (tr - r) - 2 * ZETA * OMEGA * vr) * h; r += vr * h;
      }
      out.dx = x; out.dy = y; out.tilt = r; out.vy = vy;
      return out;
    },
  };
}

type F = {
  el: HTMLElement;
  lv: (typeof LEVELS)[FloatLevel];
  b: ReturnType<typeof buoy>;
  cx: number; cy: number; // page centre, offsets removed
  ox: number; oy: number; or: number; // last applied
  on: boolean;
  ripple: number;
};

const AUTO = 'h1, h2, .h-display, .h-section, main p, main li, main a, main button, [data-float]';
const SKIP = '.nav, nav, form, [data-float="none"], [role="dialog"], [data-floated-off]';
const FIELD = 'input, textarea, select, [contenteditable="true"]';

export function startFloat(): () => void {
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  if (mqReduce.matches) return () => {};

  const all = new Map<HTMLElement, F>();
  const visible = new Set<F>();
  let calm = 1; // eased 1 -> 0 while a form field has focus
  let calmTo = 1;
  let ripT = -9;

  const io = new IntersectionObserver(
    (es) => {
      for (const e of es) {
        const f = all.get(e.target as HTMLElement);
        if (!f) continue;
        f.on = e.isIntersecting;
        if (f.on) {
          measure(f);
          visible.add(f);
        } else {
          visible.delete(f);
          clear(f);
        }
      }
    },
    { rootMargin: '80px 0px' },
  );

  function levelOf(el: HTMLElement): FloatLevel | null {
    const d = el.dataset.float;
    if (d === 'none') return null;
    if (d === 'strong' || d === 'heading' || d === 'block' || d === 'text') return d;
    if (el.matches('h1, h2, .h-display, .h-section')) return 'heading';
    return 'text';
  }

  function scan() {
    for (const f of [...all.values()]) {
      if (!f.el.isConnected) {
        io.unobserve(f.el);
        visible.delete(f);
        all.delete(f.el);
      }
    }
    for (const el of document.querySelectorAll<HTMLElement>(AUTO)) {
      if (all.has(el)) continue;
      const lv = levelOf(el);
      if (!lv || el.closest(SKIP) || el.querySelector('form')) continue;
      if (el.parentElement?.closest('[data-fl]')) continue; // an ancestor already floats
      if (!el.closest('main') && !el.dataset.float) continue; // auto levels live in main
      const cs = getComputedStyle(el);
      if (cs.display === 'inline' || cs.position === 'fixed') continue; // translate does not apply to inline boxes
      el.setAttribute('data-fl', '');
      all.set(el, { el, lv: LEVELS[lv], b: buoy({ strength: 1 }), cx: 0, cy: 0, ox: 0, oy: 0, or: 0, on: false, ripple: -9 });
      io.observe(el);
    }
  }

  function measure(f: F) {
    const r = f.el.getBoundingClientRect();
    f.cx = r.left + r.width / 2 - f.ox + scrollX;
    f.cy = r.top + r.height / 2 - f.oy + scrollY;
  }

  function clear(f: F) {
    f.el.style.translate = '';
    f.el.style.rotate = '';
    f.ox = f.oy = f.or = 0;
  }

  // cached rects: refreshed while scrolling (throttled), once it settles, and on resize
  let dirty = false;
  let lastMeasure = 0;
  let settle = 0;
  const flag = () => {
    dirty = true;
    clearTimeout(settle);
    settle = window.setTimeout(() => (dirty = true), 160);
  };
  addEventListener('scroll', flag, { passive: true });
  addEventListener('resize', flag);

  const focusIn = (e: Event) => {
    if ((e.target as Element)?.matches?.(FIELD)) calmTo = 0;
  };
  const focusOut = () => {
    calmTo = document.activeElement?.matches?.(FIELD) ? 0 : 1;
  };
  document.addEventListener('focusin', focusIn);
  document.addEventListener('focusout', () => setTimeout(focusOut));

  let mo: MutationObserver | null = null;
  let moT = 0;
  mo = new MutationObserver(() => {
    clearTimeout(moT);
    moT = window.setTimeout(scan, 400);
  });
  mo.observe(document.body, { childList: true, subtree: true });
  scan();

  let slow = 0;
  let parity = 0;
  const stop = onFrame((t, dt) => {
    // quality: on sustained slow frames, update half the floaters each frame
    slow = dt > 0.026 ? Math.min(slow + 1, 30) : Math.max(slow - 1, 0);
    const half = slow > 20;
    parity ^= 1;

    // reads first (cached-rect refresh), then all writes
    if (dirty && t - lastMeasure > 0.12) {
      dirty = false;
      lastMeasure = t;
      for (const f of visible) measure(f);
    }

    calm += (calmTo - calm) * Math.min(1, dt * 4);
    if (calm < 0.003 && calmTo === 0) calm = 0;

    let i = 0;
    for (const f of visible) {
      i++;
      if (half && (i & 1) === parity) continue;
      if (calm === 0) {
        if (f.ox || f.oy || f.or) clear(f);
        continue;
      }
      const o = f.b.step(f.cx, f.cy, dt * (half ? 2 : 1), calm);
      const dx = o.dx * (f.lv.x / LEVELS.strong.x);
      const dy = o.dy * (f.lv.y / LEVELS.strong.y);
      const dr = o.tilt * (f.lv.r / LEVELS.strong.r);
      if (Math.abs(dx - f.ox) + Math.abs(dy - f.oy) + Math.abs(dr - f.or) < 0.01) continue;
      f.ox = dx; f.oy = dy; f.or = dr;
      f.el.style.translate = `${dx.toFixed(2)}px ${dy.toFixed(2)}px`;
      f.el.style.rotate = `${dr.toFixed(3)}deg`;
      // tiny, rate-limited ripples from the ones that visibly move (own budget in the field: 8 slots)
      if (f.lv.ripple && Math.abs(o.vy) * (f.lv.y / LEVELS.strong.y) > 22 && t - f.ripple > 2.5 && t - ripT > 0.8) {
        f.ripple = ripT = t;
        addSource(f.cx, f.cy, 0.12, 9, { kind: 'float' });
      }
    }
  });

  return () => {
    stop();
    io.disconnect();
    mo?.disconnect();
    removeEventListener('scroll', flag);
    removeEventListener('resize', flag);
    document.removeEventListener('focusin', focusIn);
    for (const f of all.values()) {
      clear(f);
      f.el.removeAttribute('data-fl');
    }
  };
}
