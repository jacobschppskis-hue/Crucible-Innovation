'use client';
import { useEffect, useRef } from 'react';
import { ease, reducedMotion, seg, trackScroll } from '@/lib/scroll';
import { richTier, whenNear } from '@/lib/tier';

const ROOM = 293;
const IRON = 1811; // iron melts at 1811 K

/**
 * Scroll heats the section from room temperature (293 K) to iron's melting point (1811 K): a furnace glow rises from
 * the floor (CSS), and on the rich tier WebGL flames (lib/gl/molten.ts) come up with it: they rise at one calm pace at
 * every temperature; only their width, height and brightness grow with the heat.
 */
export function Thesis() {
  const ref = useRef<HTMLElement>(null);
  const num = useRef<HTMLSpanElement>(null);
  const cap = useRef<HTMLSpanElement>(null);
  const gl = useRef<HTMLCanvasElement>(null);
  const heat = useRef(0);

  useEffect(() => {
    if (reducedMotion()) return;
    const el = ref.current!;
    let shown = -1;
    const off = trackScroll(el, 'pin', (p) => {
      // Heat climbs at a near-steady rate through most of the pin (half linear, half smoothstep: soft at both ends,
      // never more than 1.25x the average rate), so the fire comes up evenly rather than rushing through the middle.
      const s = seg(p, 0.04, 0.84);
      const k = 0.5 * s + 0.5 * s * s * (3 - 2 * s);
      heat.current = k;
      el.style.setProperty('--k', k.toFixed(4));
      // One line fully leaves before the next arrives.
      el.style.setProperty('--xa', ease.inOut(seg(p, 0.34, 0.46)).toFixed(4));
      el.style.setProperty('--xb', ease.out(seg(p, 0.5, 0.64)).toFixed(4));
      const t = Math.round(ROOM + k * (IRON - ROOM));
      if (t !== shown) {
        shown = t;
        num.current!.textContent = String(t);
        cap.current!.textContent = t >= IRON ? 'Iron melts' : t <= ROOM ? 'Room temperature' : 'Heating';
      }
    });

    let stop: (() => void) | undefined;
    let dead = false;
    let unNear: (() => void) | undefined;
    richTier().then((ok) => {
      if (!ok || dead) return;
      // Only once the scene is within a screen or two: its GL contexts are not made during the page's first seconds.
      unNear = whenNear(el, async () => {
        const { startMolten } = await import('@/lib/gl/molten');
        if (dead) return;
        stop = startMolten({
          canvas: gl.current!,
          heat: () => heat.current,
          onReady: () => el.setAttribute('data-gl', ''),
          onFail: () => el.removeAttribute('data-gl'),
        });
      });
    });
    return () => {
      dead = true;
      unNear?.();
      off();
      stop?.();
    };
  }, []);

  return (
    <section ref={ref} aria-label="Thesis" className="thesis pin-tall relative">
      <div className="pin-sticky relative flex items-center overflow-hidden">
        <canvas ref={gl} aria-hidden className="thesis-gl" />
        <div aria-hidden className="thesis-furnace" />
        <div aria-hidden className="thesis-glow" />
        <div className="container-x relative flex w-full flex-col gap-12 py-24 lg:flex-row lg:items-end lg:justify-between">
          <div className="thesis-lines relative grid max-w-4xl">
            <div className="thesis-a [grid-area:1/1]">
              <p className="h-display text-[2.75rem] sm:text-7xl lg:text-[5.5rem]">Nothing new happens at 293 K</p>
              <p className="mt-6 text-bone-dim">293 K is room temperature.</p>
            </div>
            <div className="thesis-b [grid-area:1/1]">
              <p className="h-display text-[2.75rem] sm:text-7xl lg:text-[5.5rem]">An alloy is stronger than its metals</p>
              <p className="mt-6 text-bone-dim">Steel is harder than iron. Bronze is harder than copper.</p>
            </div>
          </div>
          <div className="w-full shrink-0 sm:w-64 lg:mb-3">
            <p className="label">Temperature</p>
            <p className="thesis-readout wide mt-2 font-display text-5xl font-semibold tabular-nums text-bone sm:text-6xl">
              <span className="sr-only">Heating from 293 kelvin, room temperature, to 1811 kelvin, the melting point of iron.</span>
              <span aria-hidden ref={num}>
                {IRON}
              </span>{' '}
              <span aria-hidden className="text-bone">
                K
              </span>
            </p>
            <div aria-hidden className="mt-4 h-1 overflow-hidden rounded-full bg-line-strong">
              <div className="thesis-bar h-full origin-left rounded-full" />
            </div>
            <p aria-hidden className="label mt-3">
              <span ref={cap}>Iron melts</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
