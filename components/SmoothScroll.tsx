'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Light Lenis smoothing for wheel/trackpad only. Never loaded on touch or with reduced motion, and not on a page that
 * paints its own world (the home page: [data-world-root], html[data-world]), whose engine runs its own scroll loop
 * (lib/world/loop.ts). Checked on every route change, the same way as the page liquid (components/Liquid.tsx).
 */
export function SmoothScroll() {
  const pathname = usePathname();
  useEffect(() => {
    if (matchMedia('(hover: none), (pointer: coarse), (prefers-reduced-motion: reduce)').matches) return;
    if (document.querySelector('[data-world], [data-world-root]')) return;
    let lenis: { destroy(): void } | undefined;
    let cancelled = false;
    import('lenis').then(({ default: Lenis }) => {
      if (cancelled) return;
      lenis = new Lenis({ lerp: 0.12, anchors: true, autoRaf: true });
    });
    return () => {
      cancelled = true;
      lenis?.destroy();
    };
  }, [pathname]);
  return null;
}
