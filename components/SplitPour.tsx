'use client';
import { useEffect, useRef } from 'react';
import { reducedMotion } from '@/lib/scroll';
import { richTier, whenNear } from '@/lib/tier';

/** Rich tier: the PayPal beat's metal (lib/gl/splitPour.ts) in a canvas under the names. Its context is made when the
 * figure nears the screen; if it can't start, the figure shows its still version (data-still). */
export function SplitPourGL() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (reducedMotion()) return;
    const canvas = ref.current!;
    const fig = canvas.closest('figure')!;
    let stop: (() => void) | undefined;
    let unNear: (() => void) | undefined;
    let dead = false;
    richTier().then((ok) => {
      if (!ok || dead) return;
      unNear = whenNear(fig, async () => {
        const { startSplitPour } = await import('@/lib/gl/splitPour');
        if (dead) return;
        stop = startSplitPour({ box: fig, canvas, onFail: () => fig.setAttribute('data-still', '') });
      });
    });
    return () => {
      dead = true;
      unNear?.();
      stop?.();
    };
  }, []);
  return <canvas ref={ref} className="sp-gl" />;
}

/** The still version's casting (light tier, reduced motion, no JS): the cooled runs from the y into the names, faint.
 * Drawn in em of the names' size (viewBox units: 100 = 1em, origin at the axis). */
export function SplitTree() {
  return <svg className="sp-tree" aria-hidden />;
}
