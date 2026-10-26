'use client';
import { useEffect, useRef } from 'react';
import { ease, reducedMotion, seg, trackScroll } from '@/lib/scroll';

const ROOM = 293;
const IRON = 1811; // iron melts at 1811 K

/** Scroll heats the section from room temperature (293 K) to iron's melting point (1811 K). */
export function Thesis() {
  const ref = useRef<HTMLElement>(null);
  const num = useRef<HTMLSpanElement>(null);
  const cap = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (reducedMotion()) return;
    const el = ref.current!;
    let shown = -1;
    return trackScroll(el, 'pin', (p) => {
      const k = ease.inOut(seg(p, 0.08, 0.78));
      el.style.setProperty('--k', k.toFixed(4));
      // One line fully leaves before the next arrives.
      el.style.setProperty('--xa', ease.inOut(seg(p, 0.34, 0.46)).toFixed(4));
      el.style.setProperty('--xb', ease.out(seg(p, 0.5, 0.64)).toFixed(4));
      const t = Math.round(ROOM + k * (IRON - ROOM));
      if (t !== shown) {
        shown = t;
        num.current!.textContent = String(t).padStart(4, '0');
        cap.current!.textContent = t >= IRON ? 'Iron melts' : t <= ROOM ? 'Room temperature' : 'Heating';
      }
    });
  }, []);

  return (
    <section ref={ref} aria-label="Thesis" className="thesis pin-tall relative border-y border-line">
      <div className="pin-sticky relative flex items-center overflow-hidden">
        <div aria-hidden className="thesis-glow" />
        <div className="container-x relative flex w-full flex-col gap-12 py-24 lg:flex-row lg:items-end lg:justify-between">
          <div className="thesis-lines relative grid max-w-4xl">
            <div className="thesis-a [grid-area:1/1]">
              <p className="font-serif-upright text-[2.75rem] leading-[1.02] tracking-[-0.015em] text-balance sm:text-7xl lg:text-[5.75rem]">
                Nothing new happens at <span className="accent">293 K.</span>
              </p>
              <p className="mt-6 font-mono text-xs text-bone-dim">293 K is room temperature.</p>
            </div>
            <div className="thesis-b [grid-area:1/1]">
              <p className="font-serif-upright text-[2.75rem] leading-[1.02] tracking-[-0.015em] text-balance sm:text-7xl lg:text-[5.75rem]">
                An alloy is stronger than its <span className="accent">metals.</span>
              </p>
              <p className="mt-6 font-mono text-xs text-bone-dim">Steel is harder than iron. Bronze is harder than copper.</p>
            </div>
          </div>
          <div className="w-full shrink-0 border-l border-line pl-5 sm:w-64 lg:mb-3">
            <p className="label">Fe · Temperature</p>
            <p className="mt-2 font-mono text-4xl tabular-nums text-bone sm:text-5xl">
              <span className="sr-only">Heating from 293 kelvin, room temperature, to 1811 kelvin, the melting point of iron.</span>
              <span aria-hidden ref={num}>
                {IRON}
              </span>{' '}
              <span aria-hidden className="text-bone-dim">
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
