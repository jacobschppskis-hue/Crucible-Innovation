'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { RING, arcOutline, cells, outlinePath } from '@/lib/splitRing';
import { ease, reducedMotion, seg, trackScroll } from '@/lib/scroll';
import { ArrowRight } from './Icons';

// Deterministic scatter for the machine cells (same on server and client). Scattered cells only tilt a little, as in
// the 3D logo (about 11 degrees at most): squares stay upright everywhere.
const scatter = (i: number) => {
  const r = (n: number) => ((Math.sin(i * 127.1 + n * 311.7) * 43758.5453) % 1 + 1) % 1;
  return { dx: 16 + r(1) * 44, dy: (r(2) - 0.5) * 64, dr: (r(3) - 0.5) * 23 };
};
const FREE = cells().filter((q) => !q.weld); // the welded end cells are part of the arcs' outlines
/** The farthest a scattered cell goes right of the core (mark units). */
const SCATTER_FAR = Math.max(...FREE.map((q, k) => q.x - RING.c + scatter(k).dx));

// The pour's ghost: a hairline technical drawing of the mark that the 3D metal is poured into (rich tier, first visit).
// Each piece's outline sits GHOST_IN units inside its edge, so the opaque metal drawn over it (the 3D pieces lie on the
// SVG to within a pixel) hides it exactly where it has filled; nothing has to keep time with the worker. The dashed
// construction lines (the circles the machine half is rasterised from, the axis, the sprue) and the crop marks stay
// until the drawing fades. Units: the mark's 64-unit box, drawn with a GM-unit margin.
const GM = 6;
const GHOST_IN = 0.35;
const GHOST_PARTS = outlinePath(GHOST_IN);
const GHOST_LINES = (() => {
  const { c, core, rings } = RING;
  const arcs = rings.map(({ r }) => `M${c} ${c - r}A${r} ${r} 0 0 1 ${c} ${c + r}`).join('');
  return `${arcs}M${-GM + 2} ${c}H${64 + GM - 2}M${c} ${-GM + 2}V${c - core}`;
})();
const CROP = 'M0 2.4V0h2.4M61.6 0H64v2.4M64 61.6V64h-2.4M2.4 64H0v-2.4';
/** Pour time (s at full tempo) by which the ghost has faded (app/globals.css: --gd 2700 ms + 350 ms): just as the
 *  metal has filled the last outline (3.05 s), while it is still hot; it sets (crust, then bone) from about 3.3 s
 *  (lib/gl3d/pour.ts). */
const GHOST_GONE = 3.05;

/** Live scroll state, read every frame by the 3D logo. */
export type IgnitionState = { sm: number; sh: number; core: number; flare: number; out: number };

/**
 * The home page's opening, one pinned scene:
 *  1. The pour (on load, rich tier): a hairline drawing of the mark scans in (.ig-ghost, CSS); in the 3D logo's own
 *     transparent canvas over it (lib/gl3d/pour.ts) a crucible tips and pours a thin white-hot stream into the core,
 *     hot trickles run down the arcs and the metal rises through the mark's own pieces, covering the drawing as it
 *     fills it; it cools to bone (the core stays orange), the drawing fades and the logo is released onto the liquid.
 *     No mould. The headline is on screen from the first paint (LCP) and lifts a little into place in step with the
 *     metal: its CSS lift is held until the first 3D frame is up (html[data-go]; .ig[data-pouring] while the pour
 *     plays), so all of it starts together. The logo is drawn in a Web Worker (lib/gl3d/sceneWorker.ts).
 *  2. First scroll: the headline parts, the ring takes the stage and comes apart. "Not the person." (the machine
 *     half scatters), "Not the model." (the human half leaves), "Neither, alone." (they fuse and the core re-ignites).
 * The canvas exists only while the opening is near the viewport. Reduced motion, no JS and no WebGL show the flat SVG
 * ring from the start with the headline in place (a failsafe in lib/tier.ts lets the lift play if the scene is slow).
 */
export function Ignition() {
  const ref = useRef<HTMLElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const state = useRef<IgnitionState>({ sm: 0, sh: 0, core: 1, flare: 0, out: 0 });

  useEffect(() => {
    const el = ref.current!;
    if (reducedMotion()) return;
    const root = document.documentElement;
    const set = (k: string, v: number) => el.style.setProperty(k, v.toFixed(4));
    const s = state.current;
    // Phones and tablets (the headline above its text, the ring in the upper half): the first line comes in as the
    // headline leaves and each line rolls into the next, so no scroll position leaves the lower half empty; the ring
    // moves down to the middle of what is left (--ry). Desktop keeps its pauses between lines: there the ring fills
    // the stage.
    const wide = matchMedia('(min-width: 1024px)');
    const off = trackScroll(el, 'pin', (p) => {
      const ph = !wide.matches;
      s.out = ease.inOut(seg(p, 0, 0.14));
      // Machine half scatters ("Not the person."), comes back while the human half leaves ("Not the model."), then both fuse.
      s.sm = ease.inOut(seg(p, 0.17, 0.3)) * (1 - ease.inOut(seg(p, 0.42, 0.54)));
      s.sh = ease.inOut(seg(p, 0.42, 0.54)) * (1 - ease.inOut(seg(p, 0.64, 0.74)));
      s.core = 1 - ease.out(seg(p, 0.15, 0.22)) + ease.out(seg(p, 0.7, 0.8));
      s.flare = seg(p, 0.7, 0.76) * (1 - ease.out(seg(p, 0.77, 0.92)));
      // Each line rises in from below and leaves upward: --tN is its opacity, --yN its offset (in its own heights).
      // On phones one line rolls up and away as the next rolls in, more than a line apart, so they never overlap.
      const in1 = ph ? seg(p, 0.055, 0.115) : seg(p, 0.2, 0.26);
      const out1 = ph ? seg(p, 0.38, 0.44) : seg(p, 0.36, 0.42);
      const in2 = ph ? seg(p, 0.4, 0.46) : seg(p, 0.46, 0.52);
      const out2 = ph ? seg(p, 0.64, 0.7) : seg(p, 0.6, 0.66);
      // The last line settles fully only once the ring has fused (core lit at 0.8).
      const in3 = ease.out(ph ? seg(p, 0.65, 0.85) : seg(p, 0.74, 0.86));
      set('--o', s.out);
      set('--sm', s.sm);
      set('--sh', s.sh);
      set('--core', s.core);
      set('--flare', s.flare);
      const k = ph ? 1 : 0.4;
      set('--t1', in1 * (1 - out1));
      set('--y1', ((1 - in1) - out1) * k);
      set('--t2', in2 * (1 - out2));
      set('--y2', ((1 - in2) - out2) * k);
      set('--t3', in3);
      set('--y3', (1 - in3) * (ph ? 1 : 0.45));
      // The copy is out of reach (links, focus) once it has faded out (its lines are gone at 0.77).
      el.toggleAttribute('data-out', s.out > 0.8);
    });

    // Where the ring goes as the headline leaves (phones and tablets): to the middle between the nav and the story
    // lines. Measured only when the layout changes (the scroll story itself only moves things with transforms).
    const stage = el.querySelector<HTMLElement>('.ig-stage')!;
    const area = el.querySelector<HTMLElement>('.ig-ring-area')!;
    const fuse = el.querySelector<HTMLElement>('.ig-fuse')!;
    // The flat ring's scatter (no WebGL) is squeezed so its farthest cell stays on screen (--fs, see .ig-px).
    const ring = el.querySelector<HTMLElement>('.ig-ring')!;
    const place = () => {
      if (wide.matches || getComputedStyle(fuse).position !== 'absolute') {
        el.style.removeProperty('--fs');
        return el.style.removeProperty('--ry');
      }
      const top = stage.getBoundingClientRect().top;
      const a = area.getBoundingClientRect();
      const from = a.top + a.height / 2 - top;
      const to = (parseFloat(getComputedStyle(stage).paddingTop) + fuse.getBoundingClientRect().top - top) / 2;
      el.style.setProperty('--ry', `${Math.max(0, Math.round(to - from))}px`);
      const ppu = (ring.offsetWidth * 1.14) / 64; // px per mark unit once the ring has taken the stage (scale 1.14)
      const room = (stage.clientWidth / 2 - 14) / ppu - (RING.px / 2) * 0.8; // to 14 px inside the edge, a cell at 80%
      el.style.setProperty('--fs', Math.min(1, Math.max(0, (room - 8) / (SCATTER_FAR - 8))).toFixed(3));
    };
    const ro = new ResizeObserver(place);
    ro.observe(stage);
    ro.observe(area);
    ro.observe(fuse);
    ro.observe(ring);

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
    let stopGhost: (() => void) | undefined;
    const ghostOff = () => {
      stopGhost?.();
      stopGhost = undefined;
    };
    // Failsafe only: the headline is on screen from the first paint; this just lets it lift if the scene is very slow.
    const late = setTimeout(() => {
      wantPour = false;
      go();
    }, 3000);
    const unmount = () => {
      ghostOff();
      stopLogo?.();
      stopLogo = undefined;
      el.removeAttribute('data-3d');
      el.removeAttribute('data-settled');
      el.removeAttribute('data-pouring');
    };
    // ?pourdebug (contact sheets): the pour clock is window.__pourT, in the worker and here, for the ghost's CSS.
    let dbgRaf = 0;
    const dbg = /[?&]pourdebug\b/.test(location.search);
    if (dbg) {
      el.setAttribute('data-pourdebug', '');
      const tick = () => {
        el.style.setProperty('--pt', String((window as unknown as { __pourT?: number }).__pourT ?? 0));
        dbgRaf = requestAnimationFrame(tick);
      };
      tick();
    }
    if (root.dataset.tier === 'rich') {
      Promise.all([import('@/lib/gl3d/logoScene'), import('@/lib/liquid/loop')]).then(([{ mountLogo }, { onFrame }]) => {
        if (dead) return;
        // The ghost keeps the metal's time: its scan and its fade are scrubbed (--pt, s at full tempo) from the one
        // clock the pour is drawn on, from the pour's first frame, so whatever the frame rate (or a stepped capture)
        // it is gone while the metal is still hot, never left over the cooled ring.
        const ghostClock = () => {
          const g = ghostRef.current;
          if (dbg || !g) return;
          let t0 = -1;
          stopGhost = onFrame((t) => {
            if (t0 < 0) t0 = t;
            const pt = (t - t0) / tempo;
            g.style.setProperty('--pt', pt.toFixed(3));
            if (pt > GHOST_GONE + 0.1) ghostOff();
          });
        };
        const mount = () => {
          if (stopLogo || failed || !hostRef.current) return;
          stopLogo = mountLogo({
            host: hostRef.current,
            story: () => state.current,
            pour: wantPour
              ? {
                  tempo,
                  start: () => {
                    wantPour = false;
                    clearTimeout(late);
                    el.setAttribute('data-pouring', '');
                    go();
                    ghostClock();
                  },
                }
              : undefined,
            onReady: () => el.setAttribute('data-3d', ''),
            onSettled: () => {
              ghostOff();
              el.setAttribute('data-settled', ''); // pour over, ring floating (screenshot tools wait on it)
              el.removeAttribute('data-pouring');
            },
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
      ro.disconnect();
      io?.disconnect();
      unmount();
      clearTimeout(late);
      cancelAnimationFrame(dbgRaf);
    };
  }, []);

  const { c, px, rings } = RING;

  return (
    <section ref={ref} aria-label="Crucible" className="ig relative">
      <div className="ig-stage relative flex flex-col overflow-hidden pt-[var(--nav-h)]">
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
              {FREE.map(({ x, y }, k) => {
                const s = scatter(k);
                const style = { '--dx': s.dx, '--dy': s.dy, '--dr': s.dr, '--bx': x - c, '--k': (k / (FREE.length - 1)).toFixed(3) } as React.CSSProperties;
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
            {/* The pour's ghost, under the 3D canvas (shown only while a pour plays; see app/globals.css). */}
            <div ref={ghostRef} aria-hidden className="ig-ghost">
              <div className="ig-ghost-scan">
                <svg viewBox={`${-GM} ${-GM} ${64 + 2 * GM} ${64 + 2 * GM}`} className="block h-full w-full" fill="none" stroke="currentColor">
                  <path className="ig-ghost-lines" d={GHOST_LINES} strokeWidth={0.13} strokeDasharray="1.4 0.7" />
                  <path className="ig-ghost-lines" d={CROP} strokeWidth={0.16} />
                  <path d={GHOST_PARTS} strokeWidth={1} vectorEffect="non-scaling-stroke" />
                  <circle cx={c} cy={c} r={RING.core - GHOST_IN} strokeWidth={1} vectorEffect="non-scaling-stroke" />
                </svg>
              </div>
            </div>
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
      </div>
    </section>
  );
}
