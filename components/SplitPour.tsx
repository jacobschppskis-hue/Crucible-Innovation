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

// The cooled runs, traced from lib/gl/splitPour.ts's own geometry (at 0.6 of the live radius: set metal has shrunk) and
// written in em of the names' size (100 = 1em) from the axis and the figure's top, so they fit the names at any size.
// Re-trace them (window.__split.geo()) if the layout in Story.css changes.
const TREE = [
  'M-5 148.5L-8.4 189L-8.6 229.6L-8.3 270.1L-8.1 310.7L-7.9 351.2L-7.7 391.8L-7.5 432.3L-7.3 472.9L-7 513.4L-6.8 554L-6.6 594.5A6.6 6.6 0 0 0 6.6 594.5L6.8 554L7 513.4L7.3 472.9L7.5 432.3L7.7 391.8L7.9 351.2L8.1 310.7L8.3 270.1L8.6 229.6L8.4 189L5 148.5A5 5 0 0 0 -5 148.5Z',
  'M-5.8 247.7L-9.2 261.9L-13.7 275.4L-19.5 288.4L-26.9 300.4L-35.8 311.2L-46.4 320.6L-58.4 328.1L-71.5 333.7L-85.3 337.5L-99.6 339.7L-114.3 340.4A3.7 3.7 0 0 0 -113.9 347.8L-98.9 347.2L-83.8 345.2L-68.8 341.6L-54.4 336L-40.9 328.2L-28.8 318.4L-18.3 306.7L-9.7 293.7L-2.9 279.8L2.2 265.2L5.8 250.5A6 6 0 0 0 -5.8 247.7Z',
  'M-5.8 250.5L-2.1 265.3L3.1 279.9L10 293.9L18.7 306.9L29.3 318.6L41.5 328.4L55.1 336.1L69.6 341.6L84.6 345.3L99.8 347.2L114.9 347.8A3.7 3.7 0 0 0 115.2 340.4L100.5 339.7L86.1 337.6L72.2 333.8L59 328.2L46.9 320.7L36.3 311.4L27.2 300.5L19.7 288.5L13.8 275.5L9.3 261.9L5.8 247.7A6 6 0 0 0 -5.8 250.5Z',
  'M-5.8 420.4L-9.3 434.6L-13.8 448.2L-19.7 461.2L-27.2 473.3L-36.3 484.1L-46.9 493.4L-59 500.9L-72.2 506.5L-86.1 510.3L-100.5 512.4L-115.2 513.1A3.7 3.7 0 0 0 -114.9 520.5L-99.8 519.9L-84.6 518L-69.6 514.4L-55.1 508.8L-41.5 501.1L-29.3 491.3L-18.7 479.7L-10 466.6L-3.1 452.6L2.1 438L5.8 423.2A6 6 0 0 0 -5.8 420.4Z',
  'M-5.8 423.2L-2.1 438L3.1 452.6L10 466.6L18.7 479.7L29.3 491.3L41.5 501.1L55.1 508.8L69.6 514.4L84.6 518L99.8 519.9L114.9 520.5A3.7 3.7 0 0 0 115.2 513.1L100.5 512.4L86.1 510.3L72.2 506.5L59 500.9L46.9 493.4L36.3 484.1L27.2 473.3L19.7 461.2L13.8 448.2L9.3 434.6L5.8 420.4A6 6 0 0 0 -5.8 423.2Z',
  'M-6.3 592.6L-10.9 608.3L-17.1 622.8L-25.1 636.4L-35 648.7L-46.7 659.3L-59.9 668L-74.4 674.9L-89.8 679.9L-105.7 683.3L-122 685.2L-138.5 685.8A3.7 3.7 0 0 0 -138.2 693.3L-121.4 692.8L-104.5 691.2L-87.7 688.2L-71.2 683.5L-55.3 676.8L-40.3 667.9L-26.8 656.7L-15.2 643.5L-5.8 628.7L1.3 612.8L6.3 596.4A6.6 6.6 0 0 0 -6.3 592.6Z',
  'M-6.3 596.4L-1.4 612.7L5.8 628.7L15.1 643.5L26.7 656.7L40.2 667.9L55.1 676.8L71 683.5L87.5 688.2L104.3 691.2L121.2 692.8L138 693.3A3.7 3.7 0 0 0 138.2 685.8L121.7 685.2L105.5 683.3L89.6 679.9L74.3 674.9L59.8 668L46.5 659.3L34.9 648.7L25 636.4L17.1 622.8L10.9 608.2L6.3 592.7A6.6 6.6 0 0 0 -6.3 596.4Z',
];

/** The still version's casting (light tier, reduced motion, no JS): the cooled runs from the y into the names, faint. */
export function SplitTree() {
  return (
    <svg className="sp-tree" viewBox="0 0 100 100" aria-hidden>
      {TREE.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
