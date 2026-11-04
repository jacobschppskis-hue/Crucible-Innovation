'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Primary buttons lean a few pixels toward the cursor and spring back (mouse only, motion-safe).
 * Works on every `.btn-primary` on the page, so no component has to opt in.
 * Large visuals marked `data-pull` (optionally `data-pull="16"`, the reach in px) are drawn toward a nearby cursor
 * the same way, so the page always answers the mouse.
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
        el.style.setProperty('--mx-px', `${(x * 8).toFixed(1)}px`);
        el.style.setProperty('--my-px', `${(y * 6).toFixed(1)}px`);
      };
      const leave = () => {
        el.style.setProperty('--mx-px', '0px');
        el.style.setProperty('--my-px', '0px');
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerleave', leave);
      offs.push(() => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerleave', leave);
      });
    });

    // Pull: one pointer listener for every [data-pull] element, one style write per element per frame at most.
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
        el.style.setProperty('--pull-x', `${(x * reach).toFixed(1)}px`);
        el.style.setProperty('--pull-y', `${(y * reach * 0.7).toFixed(1)}px`);
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
      });
    }
    return () => offs.forEach((off) => off());
  }, [pathname]);
  return null;
}
