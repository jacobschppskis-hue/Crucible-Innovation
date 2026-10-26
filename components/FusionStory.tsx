'use client';
import { useEffect, useRef } from 'react';
import { RING, arcPath, pixels } from '@/lib/splitRing';
import { ease, reducedMotion, seg, trackScroll } from '@/lib/scroll';

// Deterministic scatter for the machine pixels (same on server and client).
const scatter = (i: number) => {
  const r = (n: number) => ((Math.sin(i * 127.1 + n * 311.7) * 43758.5453) % 1 + 1) % 1;
  return { dx: 14 + r(1) * 46, dy: (r(2) - 0.5) * 70, dr: (r(3) - 0.5) * 220 };
};

/**
 * Pinned scroll story: the human half of the Split Ring draws in ("Not the person."), the machine half
 * assembles from scattered pixels ("Not the model."), then they fuse and the Ember core ignites ("Neither, alone.").
 */
export function FusionStory() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current!;
    const set = (k: string, v: number) => el.style.setProperty(k, v.toFixed(4));
    if (reducedMotion()) {
      ['--a', '--b', '--c', '--t3'].forEach((k) => set(k, 1));
      ['--t1', '--t2'].forEach((k) => set(k, 0));
      return;
    }
    return trackScroll(el, 'pin', (p) => {
      set('--a', ease.out(seg(p, 0.04, 0.3)));
      set('--b', ease.inOut(seg(p, 0.36, 0.64)));
      set('--c', ease.out(seg(p, 0.68, 0.84)));
      set('--t1', seg(p, 0.06, 0.16) * (1 - seg(p, 0.33, 0.4)));
      set('--t2', seg(p, 0.4, 0.48) * (1 - seg(p, 0.62, 0.69)));
      set('--t3', ease.out(seg(p, 0.74, 0.88)));
    });
  }, []);

  const { c, px, stroke, rings } = RING;
  let k = 0;
  const total = rings.reduce((n, r) => n + r.n, 0);

  return (
    <section ref={ref} aria-label="Neither, alone" className="fx pin-tall relative">
      <div className="pin-sticky flex flex-col items-center justify-center overflow-hidden">
        <div aria-hidden className="fx-glow" />
        <svg aria-hidden viewBox="0 0 64 64" className="fx-ring relative w-[min(64vw,26rem)] overflow-visible">
          <g className="fx-human">
            {rings.map(({ r }) => (
              <path key={r} d={arcPath(r)} pathLength={1} fill="none" stroke="var(--bone)" strokeWidth={stroke} />
            ))}
          </g>
          {rings.map(({ r, n }) =>
            pixels(r, n).map(({ x, y, deg }, i) => {
              const s = scatter(k);
              const style = { '--dx': s.dx, '--dy': s.dy, '--dr': s.dr, '--k': (k++ / (total - 1)).toFixed(3) } as React.CSSProperties;
              return (
                <g key={`${r}-${i}`} className="fx-px" style={style}>
                  <rect x={x - px / 2} y={y - px / 2} width={px} height={px} fill="var(--bone)" transform={`rotate(${deg} ${x} ${y})`} />
                </g>
              );
            }),
          )}
          <circle className="fx-core" cx={c} cy={c} r={RING.core} fill="var(--ember)" />
        </svg>

        <div className="relative mt-14 grid h-40 w-full place-items-center px-4 text-center sm:h-48">
          <p className="fx-line fx-t1 h-display text-4xl sm:text-6xl">
            Not the <span className="accent">person.</span>
          </p>
          <p className="fx-line fx-t2 h-display text-4xl sm:text-6xl">
            Not the <span className="accent">model.</span>
          </p>
          <div className="fx-line fx-t3">
            <h2 className="h-display text-5xl sm:text-7xl">
              Neither, <span className="accent">alone.</span>
            </h2>
            <p className="label mt-5">Not the person · Not the model · The mix</p>
          </div>
        </div>

        <ol aria-hidden className="fx-steps label absolute bottom-8 flex gap-6">
          <li className="fx-s1">01 Person</li>
          <li className="fx-s2">02 Model</li>
          <li className="fx-s3">03 Mix</li>
        </ol>
      </div>
    </section>
  );
}
