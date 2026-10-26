'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Primary buttons lean a few pixels toward the cursor and spring back (mouse only, motion-safe).
 * Works on every `.btn-primary` on the page, so no component has to opt in.
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
    return () => offs.forEach((off) => off());
  }, [pathname]);
  return null;
}
