'use client';
import { useEffect, useRef } from 'react';
import { ease, reducedMotion, seg, trackScroll } from '@/lib/scroll';
import { setThesisHeat } from '@/lib/world/thesis';
import './Thesis.css';

const ROOM = 293;
const IRON = 1811; // iron melts at 1811 K

/**
 * The Thesis: as you scroll, the planet's sea under the type heats from room temperature (293 K) to iron's melting point
 * (1811 K). The world draws the metal (lib/world/thesis.ts: cold, the sea is a dark mirror of the stars; hot, it glows
 * from within and flows); this component holds the words, the readout and the heat value it hands the world. The
 * readout reads Quench while cold and Ember once hot. No backing behind any of it: the camera keeps the metal low in
 * frame and the type in the sky. Reduced motion, no JS: the hot end, as the old site did.
 */
export function Thesis() {
  const ref = useRef<HTMLElement>(null);
  const num = useRef<HTMLSpanElement>(null);
  const cap = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (reducedMotion()) {
      setThesisHeat(1);
      return;
    }
    const el = ref.current!;
    let shown = -1;
    const off = trackScroll(el, 'pin', (p) => {
      // The Nov 2 timing: the heat eases in and out between 8% and 78% of the pin.
      const k = ease.inOut(seg(p, 0.08, 0.78));
      setThesisHeat(k);
      el.style.setProperty('--k', k.toFixed(4));
      // one line fully leaves before the next arrives
      el.style.setProperty('--xa', ease.inOut(seg(p, 0.3, 0.42)).toFixed(4));
      el.style.setProperty('--xb', ease.out(seg(p, 0.46, 0.6)).toFixed(4));
      const t = Math.round(ROOM + k * (IRON - ROOM));
      if (t !== shown) {
        shown = t;
        num.current!.textContent = String(t);
        cap.current!.textContent = t >= IRON ? 'Iron melts' : t <= ROOM ? 'Room temperature' : 'Heating';
      }
    });
    return off;
  }, []);

  return (
    <section ref={ref} aria-label="Thesis" className="wthesis" data-place="thesis">
      <div className="wthesis-pin">
        <div className="wthesis-in container-x">
          <div className="wthesis-lines">
            <div className="wthesis-a">
              <p className="wthesis-h wide" data-reflect>
                Nothing new happens at 293&nbsp;K
              </p>
              <p className="wthesis-s">293 K is room temperature.</p>
            </div>
            <div className="wthesis-b">
              <p className="wthesis-h wide" data-reflect>
                An alloy is stronger than its metals
              </p>
              <p className="wthesis-s">Steel is harder than iron. Bronze is harder than copper.</p>
            </div>
          </div>
          <div className="wthesis-ro">
            <p className="label">Temperature</p>
            <p className="wthesis-num wide">
              <span className="sr-only">Heating from 293 kelvin, room temperature, to 1811 kelvin, the melting point of iron.</span>
              <span aria-hidden ref={num}>
                {IRON}
              </span>
              <span aria-hidden> K</span>
            </p>
            <p aria-hidden className="label wthesis-cap">
              <span ref={cap}>Iron melts</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
