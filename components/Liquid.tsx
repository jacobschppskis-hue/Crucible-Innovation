'use client';
import { useEffect, useRef } from 'react';
import { reducedMotion } from '@/lib/scroll';
import { richTier } from '@/lib/tier';

/**
 * The liquid: one fixed canvas behind the whole page that paints the dark liquid (lib/liquid/render.ts). The renderer
 * loads after load + idle, never in the first-load JS. With reduced motion, no JS or no WebGL the page keeps its plain
 * dark ground (the html background) and nothing is hidden.
 */
export function Liquid() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (reducedMotion()) return;
    let stop: (() => void) | null = null;
    let stopFloat: (() => void) | null = null;
    let dead = false;
    richTier().then(async (ok) => {
      if (!ok || dead) return;
      const { startLiquid } = await import('@/lib/liquid/render');
      if (dead) return;
      stop = startLiquid(ref.current!);
      if (stop && !dead) {
        const { startFloat } = await import('@/lib/liquid/float');
        if (!dead) stopFloat = startFloat();
      }
    });
    return () => {
      dead = true;
      stopFloat?.();
      stop?.();
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="liquid" />;
}
