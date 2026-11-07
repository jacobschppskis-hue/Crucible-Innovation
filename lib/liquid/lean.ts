// Magnetic lean: primary buttons lean toward the cursor and large visuals ([data-pull]) are drawn toward it, then spring
// back (components/Magnetic.tsx sets the targets). One writer per element: an element the floating owns (float.ts)
// gets its lean added to its float offset there; any other element is written here. Springs run on the one clock and
// stop when everything is at rest. Tiny on purpose: this is in the first-load JS (Magnetic is in the layout).

import { onFrame } from './loop';

type Lean = { el: HTMLElement; tx: number; ty: number; x: number; y: number; vx: number; vy: number; w: number; owned: boolean };

const all = new Map<HTMLElement, Lean>();
let stop: (() => void) | null = null;
const ZETA = 0.9;

function frame(_t: number, dt: number) {
  let moving = false;
  const h = Math.min(dt, 0.05);
  for (const l of all.values()) {
    const ax = l.w * l.w * (l.tx - l.x) - 2 * ZETA * l.w * l.vx;
    const ay = l.w * l.w * (l.ty - l.y) - 2 * ZETA * l.w * l.vy;
    l.vx += ax * h;
    l.vy += ay * h;
    l.x += l.vx * h;
    l.y += l.vy * h;
    const rest = Math.abs(l.tx - l.x) < 0.01 && Math.abs(l.ty - l.y) < 0.01 && Math.abs(l.vx) + Math.abs(l.vy) < 0.05;
    if (rest) {
      l.x = l.tx;
      l.y = l.ty;
      l.vx = l.vy = 0;
    } else moving = true;
    if (!l.owned) l.el.style.translate = l.x || l.y ? `${l.x.toFixed(2)}px ${l.y.toFixed(2)}px` : '';
    if (rest && !l.tx && !l.ty && !l.owned) all.delete(l.el);
  }
  if (!moving) {
    stop?.();
    stop = null;
  }
}

/** Lean `el` toward (x, y) px; `settle` = seconds to come to rest (0.6 buttons, 0.9 large visuals). */
export function setLean(el: HTMLElement, x: number, y: number, settle = 0.6) {
  let l = all.get(el);
  if (!l) {
    if (!x && !y) return;
    l = { el, tx: 0, ty: 0, x: 0, y: 0, vx: 0, vy: 0, w: 5, owned: owned.has(el) };
    all.set(el, l);
  }
  l.tx = x;
  l.ty = y;
  l.w = 4.75 / Math.max(0.1, settle);
  stop ??= onFrame(frame);
}

/** Current lean offset of `el` (px), for the owner that composes it. */
export function leanOf(el: HTMLElement): { x: number; y: number } | null {
  const l = all.get(el);
  return l ? l : null;
}

const owned = new Set<HTMLElement>();
/** float.ts owns `el` (it writes its translate, lean included) or gives it back. */
export function own(el: HTMLElement, on: boolean) {
  if (on) owned.add(el);
  else owned.delete(el);
  const l = all.get(el);
  if (l) l.owned = on;
}
