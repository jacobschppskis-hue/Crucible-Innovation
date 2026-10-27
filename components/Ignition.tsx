'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { RING, arcPath, pixels } from '@/lib/splitRing';
import { ease, reducedMotion, seg, trackScroll } from '@/lib/scroll';
import { richTier } from '@/lib/tier';
import { HeatField } from './HeatField';
import { ArrowRight } from './Icons';

// Deterministic scatter for the machine pixels (same on server and client).
const scatter = (i: number) => {
  const r = (n: number) => ((Math.sin(i * 127.1 + n * 311.7) * 43758.5453) % 1 + 1) % 1;
  return { dx: 16 + r(1) * 44, dy: (r(2) - 0.5) * 64, dr: (r(3) - 0.5) * 220 };
};

/** Live scroll state, read every frame by the rich tier's particle ring. */
export type IgnitionState = { sm: number; sh: number; core: number; flare: number; out: number };

/**
 * The home page's opening, one pinned scene:
 *  1. Ignition (on load, pure CSS): the Ember core sparks, the human arcs draw, the machine pixels are stamped
 *     in hot and cool, the headline rises out of its masks and "alloyed." cools from white-hot to bone.
 *  2. First scroll: the headline parts, the ring takes the stage and comes apart. "Not the person." (the machine
 *     half scatters), "Not the model." (the human half leaves), "Neither, alone." (they fuse and the core re-ignites).
 * Rich tier: once the page is idle and the device proves capable, a WebGL particle ring takes over from the SVG.
 * Reduced motion and no JS: no pinning, every part shows its finished state.
 */
export function Ignition() {
  const ref = useRef<HTMLElement>(null);
  const ringRef = useRef<SVGSVGElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const state = useRef<IgnitionState>({ sm: 0, sh: 0, core: 1, flare: 0, out: 0 });

  useEffect(() => {
    const el = ref.current!;
    if (reducedMotion()) return;
    const set = (k: string, v: number) => el.style.setProperty(k, v.toFixed(4));
    const s = state.current;
    const off = trackScroll(el, 'pin', (p) => {
      s.out = ease.inOut(seg(p, 0, 0.14));
      // Machine half scatters ("Not the person."), comes back while the human half leaves ("Not the model."), then both fuse.
      s.sm = ease.inOut(seg(p, 0.17, 0.3)) * (1 - ease.inOut(seg(p, 0.42, 0.54)));
      s.sh = ease.inOut(seg(p, 0.42, 0.54)) * (1 - ease.inOut(seg(p, 0.64, 0.74)));
      s.core = 1 - ease.out(seg(p, 0.15, 0.22)) + ease.out(seg(p, 0.7, 0.8));
      s.flare = seg(p, 0.7, 0.76) * (1 - ease.out(seg(p, 0.77, 0.92)));
      set('--o', s.out);
      set('--sm', s.sm);
      set('--sh', s.sh);
      set('--core', s.core);
      set('--flare', s.flare);
      set('--f', seg(p, 0.12, 0.2));
      set('--t1', seg(p, 0.2, 0.26) * (1 - seg(p, 0.36, 0.42)));
      set('--t2', seg(p, 0.46, 0.52) * (1 - seg(p, 0.6, 0.66)));
      set('--t3', ease.out(seg(p, 0.74, 0.86)));
      el.toggleAttribute('data-out', s.out > 0.5);
    });

    // Rich tier: hand the ring over to WebGL particles once the page is idle and the device has proved itself.
    let stop: (() => void) | undefined;
    let dead = false;
    richTier().then(async (ok) => {
      if (!ok || dead) return;
      const { startRing } = await import('@/lib/gl/ringParticles');
      // The particles start from the finished ring, so never take over while the SVG is still drawing itself.
      const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0;
      const introEnd = fcp + (document.documentElement.dataset.intro === 'quick' ? 0.45 : 1) * 2600;
      await new Promise((r) => setTimeout(r, Math.max(0, introEnd - performance.now())));
      if (dead) return;
      stop = startRing({
        canvas: glRef.current!,
        ring: ringRef.current!,
        state: state.current,
        onReady: () => el.setAttribute('data-gl', ''),
        onFail: () => el.removeAttribute('data-gl'),
      });
    });
    return () => {
      dead = true;
      off();
      stop?.();
    };
  }, []);

  const { c, px, stroke, rings } = RING;
  let k = 0;
  const total = rings.reduce((n, r) => n + r.n, 0);

  return (
    <section ref={ref} aria-label="Crucible" className="ig relative">
      <div className="ig-stage relative flex flex-col overflow-hidden pt-[var(--nav-h)]">
        <div aria-hidden className="ig-heat pointer-events-none absolute inset-0">
          <HeatField anchor=".ig-ring" />
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-ground" />

        {/* The ring: SVG for everyone; the rich tier draws particles over it on the canvas below. */}
        <div className="ig-ring-area relative flex flex-1 items-center justify-center py-6">
          <div className="ig-ring">
            <div aria-hidden className="ig-glow">
              <span />
            </div>
            <div aria-hidden className="ig-spark" />
            <div aria-hidden className="ig-flare" />
            <div aria-hidden className="ig-shock" />
            <svg ref={ringRef} aria-hidden viewBox="0 0 64 64" className="ig-svg relative block h-full w-full overflow-visible">
              <g className="ig-human">
                {rings.map(({ r }, ri) => (
                  <path
                    key={r}
                    className="ig-arc"
                    style={{ '--ri': ri } as React.CSSProperties}
                    d={arcPath(r)}
                    pathLength={1}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={stroke}
                  />
                ))}
              </g>
              {rings.map(({ r, n }) =>
                pixels(r, n).map(({ x, y, deg }, i) => {
                  const s = scatter(k);
                  const style = { '--dx': s.dx, '--dy': s.dy, '--dr': s.dr, '--k': (k / (total - 1)).toFixed(3), '--i': k++ } as React.CSSProperties;
                  return (
                    <g key={`${r}-${i}`} className="ig-px" style={style}>
                      <g className="ig-pop">
                        <rect x={x - px / 2} y={y - px / 2} width={px} height={px} fill="currentColor" transform={`rotate(${deg} ${x} ${y})`} />
                      </g>
                    </g>
                  );
                }),
              )}
              <g className="ig-core-g">
                <circle className="ig-core" cx={c} cy={c} r={RING.core} fill="var(--ember)" />
              </g>
            </svg>
          </div>
        </div>
        <canvas ref={glRef} aria-hidden className="ig-gl pointer-events-none absolute inset-0 h-full w-full" />

        {/* Headline: two giant lines that rise out of their masks, then part as you scroll. */}
        <div className="ig-copy container-x relative pb-8 sm:pb-12">
          <h1 className="ig-title h-display">
            <span className="ig-line ig-l1">
              <span className="ig-in">Intelligence,</span>
            </span>{' '}
            <span className="ig-line ig-l2">
              <span className="ig-in">
                <span className="accent ig-cool">alloyed.</span>
              </span>
            </span>
          </h1>
          <div className="ig-meta mt-6 flex flex-col gap-6 lg:absolute lg:bottom-14 lg:right-8 lg:mt-0 lg:max-w-[23rem]">
            <p className="text-base leading-relaxed text-bone-dim sm:text-lg">
              Human judgment and machine range, fused into one material. Crucible is a studio that builds and ships ventures.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/sites" className="btn btn-primary">
                See Crucible Sites <ArrowRight />
              </Link>
              <a href="#ventures" className="btn btn-ghost">
                Our ventures
              </a>
            </div>
          </div>
        </div>

        {/* Fusion lines: the scroll story told under the ring. */}
        <div className="ig-fuse px-4 text-center">
          <p className="ig-fl ig-t1 h-display text-4xl sm:text-6xl">
            Not the <span className="accent">person.</span>
          </p>
          <p className="ig-fl ig-t2 h-display text-4xl sm:text-6xl">
            Not the <span className="accent">model.</span>
          </p>
          <div className="ig-fl ig-t3">
            <h2 className="h-display text-5xl sm:text-7xl">
              Neither, <span className="accent">alone.</span>
            </h2>
            <p className="label mt-5">Not the person · Not the model · The mix</p>
          </div>
        </div>

        <ol aria-hidden className="ig-steps label">
          <li className="ig-s1">01 Person</li>
          <li className="ig-s2">02 Model</li>
          <li className="ig-s3">03 Mix</li>
        </ol>
        <div aria-hidden className="ig-cue">
          <span />
        </div>
      </div>
    </section>
  );
}
