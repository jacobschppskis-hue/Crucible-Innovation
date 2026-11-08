'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Light Lenis smoothing for wheel/trackpad only. Never loaded on touch or with reduced motion, and not on a page that
 * paints its own world (an element with data-world: the home page), whose engine owns the scroll (its loop).
 */
export function SmoothScroll() {
  const pathname = usePathname();
  useEffect(() => {
    if (matchMedia('(hover: none), (pointer: coarse), (prefers-reduced-motion: reduce)').matches) return;
    if (document.querySelector('[data-world]')) return;
    let lenis: { destroy(): void } | undefined;
    let cancelled = false;
    // The home page's world (lib/world/loop.ts) runs its own Lenis (the loop): this one steps aside while it is on.
    const start = () => {
      if (lenis || cancelled || document.querySelector('[data-world-root]')) return;
      import('lenis').then(({ default: Lenis }) => {
        if (cancelled || lenis || document.querySelector('[data-world-root]')) return;
        lenis = new Lenis({ lerp: 0.12, anchors: true, autoRaf: true });
      });
    };
    const onWorld = (e: Event) => {
      if ((e as CustomEvent<{ on: boolean }>).detail.on) {
        lenis?.destroy();
        lenis = undefined;
      } else setTimeout(start, 0);
    };
    addEventListener('crucible:world', onWorld);
    start();
    return () => {
      cancelled = true;
      removeEventListener('crucible:world', onWorld);
      lenis?.destroy();
    };
  }, [pathname]);
  return null;
}
