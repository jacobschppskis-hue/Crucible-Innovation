'use client';
import { useEffect } from 'react';

/** Light Lenis smoothing for wheel/trackpad only. Never loaded on touch or with reduced motion. */
export function SmoothScroll() {
  useEffect(() => {
    if (matchMedia('(hover: none), (pointer: coarse), (prefers-reduced-motion: reduce)').matches) return;
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
  }, []);
  return null;
}
