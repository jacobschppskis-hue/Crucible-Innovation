'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { RING, arcOutline, cells } from '@/lib/splitRing';
import { ease, reducedMotion, seg, trackScroll } from '@/lib/scroll';
import { HeatField } from './HeatField';
import { ArrowRight } from './Icons';

// Deterministic scatter for the machine cells (same on server and client). Scattered cells only tilt a little, as in
// the 3D logo (about 11 degrees at most): squares stay upright everywhere.
const scatter = (i: number) => {
  const r = (n: number) => ((Math.sin(i * 127.1 + n * 311.7) * 43758.5453) % 1 + 1) % 1;
  return { dx: 16 + r(1) * 44, dy: (r(2) - 0.5) * 64, dr: (r(3) - 0.5) * 23 };
};

/** Live scroll state, read every frame by the 3D logo. */
export type IgnitionState = { sm: number; sh: number; core: number; flare: number; out: number };

/**
 * The home page's opening, one pinned scene:
 *  1. The pour (on load, rich tier): in the 3D logo's own transparent canvas (lib/gl3d/pour.ts) a crucible tips and
 *     pours white-hot metal into the core, the metal rises through a freestanding sand mould of the mark, cools to
 *     bone while the mould falls away, and the logo is released onto the liquid. The headline is on screen from the
 *     first paint (LCP) and lifts a little into place in step with the metal: its CSS lift is held until the first 3D
 *     frame is up (html[data-go]), so both start together. The logo is drawn in a Web Worker (lib/gl3d/sceneWorker.ts).
 *  2. First scroll: the headline parts, the ring takes the stage and comes apart. "Not the person." (the machine
 *     half scatters), "Not the model." (the human half leaves), "Neither, alone." (they fuse and the core re-ignites).
 * The canvas exists only while the opening is near the viewport. Reduced motion, no JS and no WebGL show the flat SVG
 * ring from the start with the headline in place (a failsafe in lib/tier.ts lets the lift play if the scene is slow).
 */
export function Ignition() {
  const ref = useRef<HTMLElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const state = useRef<IgnitionState>({ sm: 0, sh: 0, core: 1, flare: 0, out: 0 });

  useEffect(() => {
    const el = ref.current!;
    if (reducedMotion()) return;
    const root = document.documentElement;
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

    // Rich tier (every visit but reduced motion): the 3D logo's canvas is mounted as soon as the opening is within a
    // screen or two of the viewport, and pours the metal on the first visit to the page. It never gets in the way of
    // the headline: if it isn't up in time the headline goes alone and the logo simply appears finished.
    const quick = root.dataset.intro === 'quick';
    const tempo = quick ? 0.45 : 1;
    const go = () => root.setAttribute('data-go', '');
    let wantPour = root.dataset.tier === 'rich' && root.hasAttribute('data-pour') && !root.hasAttribute('data-go');
    let dead = false;
    let stopLogo: (() => void) | undefined;
    let io: IntersectionObserver | undefined;
    let failed = false;
    // Failsafe only: the headline is on screen from the first paint; this just lets it lift if the scene is very slow.
    const late = setTimeout(() => {
      wantPour = false;
      go();
    }, 3000);
    const unmount = () => {
      stopLogo?.();
      stopLogo = undefined;
      el.removeAttribute('data-3d');
      el.removeAttribute('data-settled');
    };
    if (root.dataset.tier === 'rich') {
      import('@/lib/gl3d/logoScene').then(({ mountLogo }) => {
        if (dead) return;
        const mount = () => {
          if (stopLogo || failed || !hostRef.current) return;
          stopLogo = mountLogo({
            host: hostRef.current,
            story: () => state.current,
            pour: wantPour ? { tempo, start: () => ((wantPour = false), clearTimeout(late), go()) } : undefined,
            onReady: () => el.setAttribute('data-3d', ''),
            onSettled: () => el.setAttribute('data-settled', ''), // pour over, ring floating (screenshot tools wait on it)
            onFail: () => {
              failed = true;
              stopLogo = undefined;
              clearTimeout(late);
              root.setAttribute('data-nopour', ''); // no GL: the headline simply sits in place
              go();
            },
          });
        };
        io = new IntersectionObserver(([e]) => (e.isIntersecting ? mount() : unmount()), { rootMargin: '100% 0px 100% 0px' });
        io.observe(el);
      });
    } else go();
    return () => {
      dead = true;
      off();
      io?.disconnect();
      unmount();
      clearTimeout(late);
    };
  }, []);

  const { c, px, rings } = RING;
  const free = cells().filter((q) => !q.weld); // the welded end cells are part of the arcs' outlines

  return (
    <section ref={ref} aria-label="Crucible" className="ig relative">
      <div className="ig-stage relative flex flex-col overflow-hidden pt-[var(--nav-h)]">
        <div aria-hidden className="ig-heat pointer-events-none absolute inset-0">
          <HeatField anchor=".ig-ring" />
        </div>

        {/* The ring: SVG for everyone; the rich tier hands it over to the 3D logo (canvas inside .ig-3d-host). */}
        <div className="ig-ring-area relative flex flex-1 items-center justify-center py-6">
          <div className="ig-ring">
            <div aria-hidden className="ig-glow">
              <span />
            </div>
            <svg aria-hidden viewBox="0 0 64 64" className="ig-svg relative block h-full w-full overflow-visible">
              <g className="ig-human">
                {rings.map(({ r }) => (
                  <path key={r} d={arcOutline(r)} fill="currentColor" />
                ))}
              </g>
              {free.map(({ x, y }, k) => {
                const s = scatter(k);
                const style = { '--dx': s.dx, '--dy': s.dy, '--dr': s.dr, '--k': (k / (free.length - 1)).toFixed(3) } as React.CSSProperties;
                return (
                  <g key={k} className="ig-px" style={style}>
                    <rect x={x - px / 2} y={y - px / 2} width={px} height={px} fill="currentColor" />
                  </g>
                );
              })}
              <g className="ig-core-g">
                <circle cx={c} cy={c} r={RING.core} fill="var(--ember)" />
              </g>
            </svg>
            <div ref={hostRef} aria-hidden className="ig-3d-host" />
          </div>
        </div>

        {/* Headline: two giant lines that rise out of their masks, then part as you scroll. */}
        <div className="ig-copy container-x relative pb-8 sm:pb-12">
          <h1 className="ig-title h-display">
            <span className="ig-line ig-l1">
              <span className="ig-in">Intelligence,</span>
            </span>{' '}
            <span className="ig-line ig-l2">
              <span className="ig-in">
                <span className="ig-cool" data-text="alloyed">
                  alloyed
                </span>
              </span>
            </span>
          </h1>
          <div className="ig-meta mt-6 flex flex-col gap-6 lg:absolute lg:bottom-6 lg:right-8 lg:mt-0 lg:max-w-[22rem]">
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
            Not the person
          </p>
          <p className="ig-fl ig-t2 h-display text-4xl sm:text-6xl">
            Not the model
          </p>
          <div className="ig-fl ig-t3">
            <h2 className="h-display text-5xl sm:text-7xl">Neither, alone</h2>
          </div>
        </div>

        <div aria-hidden className="ig-cue">
          <span />
        </div>
      </div>
    </section>
  );
}
