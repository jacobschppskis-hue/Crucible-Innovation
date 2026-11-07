'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

type SetLean = (el: HTMLElement, x: number, y: number, settle?: number) => void;
// The springs (lib/liquid/lean.ts, on the one clock) load on the first pointer move, never in the first-load JS.
let lean: SetLean | null = null;
let loading: Promise<void> | null = null;
const setLean: SetLean = (el, x, y, settle) => {
  if (lean) return lean(el, x, y, settle);
  loading ??= import('@/lib/liquid/lean').then((m) => {
    lean = m.setLean;
  });
  loading.then(() => lean?.(el, x, y, settle));
};

/**
 * Primary buttons lean a few pixels toward the cursor and spring back (mouse only, motion-safe).
 * Works on every `.btn-primary` on the page, so no component has to opt in.
 * Large visuals marked `data-pull` (optionally `data-pull="16"`, the reach in px) are drawn toward a nearby cursor
 * the same way, so the page always answers the mouse.
 * The springs live in lib/liquid/lean.ts: one writer per element (the floating adds the lean to its own offset).
 */
export function Magnetic() {
  const pathname = usePathname();
  useEffect(() => {
    if (!matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)').matches) return;
    const offs: (() => void)[] = [];
    document.querySelectorAll<HTMLElement>('.btn-primary').forEach((el) => {
      const move = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - (r.left + r.width / 2)) / r.width;
        const y = (e.clientY - (r.top + r.height / 2)) / r.height;
        setLean(el, x * 8, y * 6, 0.6);
      };
      const leave = () => setLean(el, 0, 0, 0.6);
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerleave', leave);
      offs.push(() => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerleave', leave);
        setLean(el, 0, 0, 0.6);
      });
    });

    // Pull: one pointer listener for every [data-pull] element, targets updated once per frame at most.
    const pulls = [...document.querySelectorAll<HTMLElement>('[data-pull]')];
    let raf = 0;
    let mx = -1e4;
    let my = -1e4;
    const apply = () => {
      raf = 0;
      for (const el of pulls) {
        const r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) continue;
        const reach = Number(el.dataset.pull) || 12;
        const pad = Math.min(r.width, r.height) * 0.25;
        const near = mx > r.left - pad && mx < r.right + pad && my > r.top - pad && my < r.bottom + pad;
        const x = near ? Math.max(-1, Math.min(1, (mx - (r.left + r.width / 2)) / (r.width / 2))) : 0;
        const y = near ? Math.max(-1, Math.min(1, (my - (r.top + r.height / 2)) / (r.height / 2))) : 0;
        setLean(el, x * reach, y * reach * 0.7, 0.9);
      }
    };
    const onMove = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    if (pulls.length) {
      addEventListener('pointermove', onMove, { passive: true });
      offs.push(() => {
        removeEventListener('pointermove', onMove);
        cancelAnimationFrame(raf);
        for (const el of pulls) setLean(el, 0, 0, 0.9);
      });
    }
    return () => offs.forEach((off) => off());
  }, [pathname]);
  return null;
}
