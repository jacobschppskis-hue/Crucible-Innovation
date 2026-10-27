'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { RING, arcPath, dotsSvg, pixels } from '@/lib/splitRing';
import { ease, reducedMotion, seg, trackScroll } from '@/lib/scroll';
import { richTier } from '@/lib/tier';
import { HeatField } from './HeatField';
import { ArrowRight } from './Icons';

// Deterministic scatter for the machine pixels (same on server and client).
const scatter = (i: number) => {
  const r = (n: number) => ((Math.sin(i * 127.1 + n * 311.7) * 43758.5453) % 1 + 1) % 1;
  return { dx: 16 + r(1) * 44, dy: (r(2) - 0.5) * 64, dr: (r(3) - 0.5) * 220 };
};

// ---- The pour (intro), all in ring units: the 64-unit viewBox, y down. ----
const u = (n: number) => `${+((n / 64) * 100).toFixed(4)}%`;
const fx = (n: number) => +n.toFixed(3);
const LIP = { x: 32.55, y: -7.4 }; // the crucible's pouring lip, straight above the gates
const CORE_TOP = RING.c - RING.core;
// Everything that moves in the pour is a CSS mask (an SVG image) over an element that only translates, rotates or
// fades, so it all runs on the compositor and costs the main thread nothing while the page is still loading.
const svgUrl = (svg: string) => `url("data:image/svg+xml,${svg.replace(/"/g, "'").replace(/[%#<>{}]/g, encodeURIComponent)}")`;
const svgDoc = (box: string, body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}">${body}</svg>`;
// The molten metal is the mark as a dot matrix, over a moving heat gradient.
const DOTS = svgUrl(dotsSvg());
// The mould: channel outlines, pixel cavities, runners, sprue and core, drawn like a technical drawing.
const MOULD_BOX = { x: -4, y: -8, w: 72, h: 76 };
const MOULD = (() => {
  const { c, px, rings } = RING;
  const h = px / 2;
  const channels = rings.map(({ r }) => {
    const [o, i] = [r + 1.5, r - 1.5];
    return `M32 ${c - o}A${o} ${o} 0 0 0 32 ${c + o}V${c + i}A${i} ${i} 0 0 1 32 ${c - i}Z`;
  });
  const cavities = rings.map(({ r, n }) =>
    pixels(r, n)
      .map(({ x, y, deg }) => {
        const a = (deg * Math.PI) / 180;
        const [cs, sn] = [Math.cos(a), Math.sin(a)];
        const pt = (p: number, q: number) => `${fx(x + p * cs - q * sn)} ${fx(y + p * sn + q * cs)}`;
        return `M${pt(-h, -h)}L${pt(h, -h)}L${pt(h, h)}L${pt(-h, h)}Z`;
      })
      .join(''),
  );
  const runners = rings.map(({ r }) => `M32 ${c - r}A${r} ${r} 0 0 1 32 ${c + r}`).join('');
  const crop = 'M0 2.4V0h2.4M61.6 0H64v2.4M64 61.6V64h-2.4M2.4 64H0v-2.4';
  const { x, y, w, h: bh } = MOULD_BOX;
  return svgUrl(
    svgDoc(
      `${x} ${y} ${w} ${bh}`,
      `<g fill="none" stroke="#fff" stroke-width=".16"><path d="${[...channels, ...cavities].join('')}"/><circle cx="${c}" cy="${c}" r="${RING.core}"/></g>` +
        `<path fill="none" stroke="#fff" stroke-opacity=".6" stroke-width=".11" stroke-dasharray="1.4 .7" d="${runners}M32 ${LIP.y + 1}V${CORE_TOP}M-3 ${c}H67${crop}"/>`,
    ),
  );
})();
// Metal running down each arc's channel ahead of the fill: the arc's centre line, revealed by a turning half-plane.
const TRICKLE = RING.rings.map(({ r }) =>
  svgUrl(svgDoc('0 0 64 64', `<path fill="none" stroke="#fff" stroke-width=".55" d="M32 ${RING.c - r}A${r} ${r} 0 0 0 32 ${RING.c + r}"/>`)),
);
// Sparks thrown up where the stream lands in the core: drift, rise and fall in % of the ring, duration ms, delay ms.
const SPARKS: [number, number, number, number, number][] = [
  [-16, -14, 10, 620, 0], [12, -18, 6, 700, 40], [-9, -24, 6, 800, 120], [20, -9, 16, 560, 200], [-24, -8, 20, 640, 300],
  [14, -23, 10, 780, 400], [-13, -19, 4, 720, 520], [4, -26, 2, 820, 640], [24, -16, 8, 760, 760], [-19, -13, 14, 660, 880],
];

/** Live scroll state, read every frame by the rich tier's particle ring. */
export type IgnitionState = { sm: number; sh: number; core: number; flare: number; out: number; melt: number };

/**
 * The home page's opening, one pinned scene:
 *  1. The pour (on load, pure CSS): a mould is drawn, pixels drop into a crucible and melt, the crucible tips and
 *     pours, the stream fills the core and the metal rises through the mould as a matrix of molten dots. It cools
 *     from white-hot through orange to bone and sets solid, while the headline rises and "alloyed." cools with it.
 *  2. First scroll: the headline parts, the ring takes the stage and comes apart. "Not the person." (the machine
 *     half scatters), "Not the model." (the human half leaves), "Neither, alone." (they fuse and the core re-ignites).
 * Rich tier: once the page is idle and the device proves capable, the story is told in WebGL: the ring melts into
 * molten dots as it starts, comes apart and fuses as dots, and sets solid again at the end.
 * Reduced motion and no JS: no pinning, every part shows its finished state.
 */
export function Ignition() {
  const ref = useRef<HTMLElement>(null);
  const ringRef = useRef<SVGSVGElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const state = useRef<IgnitionState>({ sm: 0, sh: 0, core: 1, flare: 0, out: 0, melt: 0 });

  useEffect(() => {
    const el = ref.current!;
    if (reducedMotion()) return;
    // Once the pour is done, take it out of the page for good. Hiding it isn't enough everywhere: some engines keep
    // a hidden element's composited layers on screen, and its dots would show through when the ring melts.
    const pour = el.querySelector<HTMLElement>('.ig-pour');
    const poured = () => pour?.style.setProperty('display', 'none');
    const onPoured = (e: AnimationEvent) => e.target === pour && e.animationName === 'ig-gone' && poured();
    pour?.addEventListener('animationend', onPoured);
    const pourTimer = setTimeout(poured, (document.documentElement.dataset.intro === 'quick' ? 0.45 : 1) * 4600 + 500);
    const set = (k: string, v: number) => el.style.setProperty(k, v.toFixed(4));
    const s = state.current;
    const off = trackScroll(el, 'pin', (p) => {
      s.out = ease.inOut(seg(p, 0, 0.14));
      // Machine half scatters ("Not the person."), comes back while the human half leaves ("Not the model."), then both fuse.
      s.sm = ease.inOut(seg(p, 0.17, 0.3)) * (1 - ease.inOut(seg(p, 0.42, 0.54)));
      s.sh = ease.inOut(seg(p, 0.42, 0.54)) * (1 - ease.inOut(seg(p, 0.64, 0.74)));
      s.core = 1 - ease.out(seg(p, 0.15, 0.22)) + ease.out(seg(p, 0.7, 0.8));
      s.flare = seg(p, 0.7, 0.76) * (1 - ease.out(seg(p, 0.77, 0.92)));
      // Rich tier: the ring melts into dots as the story starts and sets solid again at the fusion.
      s.melt = ease.inOut(seg(p, 0.08, 0.17)) * (1 - ease.inOut(seg(p, 0.76, 0.86)));
      set('--melt', s.melt);
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

    // Rich tier: once the page is idle and the device has proved itself, the scroll story melts the ring into dots.
    let stop: (() => void) | undefined;
    let dead = false;
    richTier().then(async (ok) => {
      if (!ok || dead) return;
      const { startRing } = await import('@/lib/gl/ringParticles');
      // Never start while the metal is still being poured.
      const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0;
      const introEnd = fcp + (document.documentElement.dataset.intro === 'quick' ? 0.45 : 1) * 4600;
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
      pour?.removeEventListener('animationend', onPoured);
      clearTimeout(pourTimer);
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
            <Pour />
            <svg ref={ringRef} aria-hidden viewBox="0 0 64 64" className="ig-svg relative block h-full w-full overflow-visible">
              <g className="ig-human">
                {rings.map(({ r }) => (
                  <path key={r} d={arcPath(r)} fill="none" stroke="currentColor" strokeWidth={stroke} />
                ))}
              </g>
              {rings.map(({ r, n }) =>
                pixels(r, n).map(({ x, y, deg }, i) => {
                  const s = scatter(k);
                  const style = { '--dx': s.dx, '--dy': s.dy, '--dr': s.dr, '--k': (k++ / (total - 1)).toFixed(3) } as React.CSSProperties;
                  return (
                    <g key={`${r}-${i}`} className="ig-px" style={style}>
                      <rect x={x - px / 2} y={y - px / 2} width={px} height={px} fill="currentColor" transform={`rotate(${deg} ${x} ${y})`} />
                    </g>
                  );
                }),
              )}
              <g className="ig-core-g">
                <circle cx={c} cy={c} r={RING.core} fill="var(--ember)" />
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
                <span className="accent ig-cool" data-text="alloyed.">
                  alloyed.
                </span>
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

// The crucible, drawn around its lip (0, 0) in ring units and drawn at 0.9 scale; its box in that frame.
const CRU = { x: -11.2, y: -1.2, w: 12.4, h: 10.6, k: 0.9 };
const cx = (x: number) => `${fx(((x - CRU.x) / CRU.w) * 100)}%`;
const cy = (y: number) => `${fx(((y - CRU.y) / CRU.h) * 100)}%`;
const poly = (pts: [number, number][]) => `polygon(${pts.map(([x, y]) => `${cx(x)} ${cy(y)}`).join(',')})`;
const INSIDE: [number, number][] = [[-9.15, -0.5], [-9.15, 0], [-8.05, 6.6], [-7.7, 7.35], [-6.8, 7.6], [-3.6, 7.6], [-2.7, 7.35], [-2.35, 6.6], [-1.35, 0], [0, -0.05], [-0.6, -0.5]];
const CRU_OUT = 'M-10 0L-8.85 6.9Q-8.55 8.4-7.05 8.4H-3.35Q-1.85 8.4-1.55 6.9L-0.5 0Z';
const CRU_IN = 'M-9.15 0L-8.05 6.6Q-7.8 7.6-6.8 7.6H-3.6Q-2.6 7.6-2.35 6.6L-1.35 0Z';
const INGOTS: [number, number, number][] = [[-6.35, 6.45, 0], [-4.1, 6.45, 0], [-5.25, 4.25, 9]];

/**
 * The intro's pour, layered over and under the solid ring (which only shows once the metal has set). Pure CSS
 * animation; display: none without JS or with reduced motion, and hidden again once it's done.
 */
function Pour() {
  const { c, core } = RING;
  return (
    <div aria-hidden className="ig-pour" style={{ '--dots': DOTS } as React.CSSProperties}>
      {/* The mould, scanned in from the top. */}
      <div
        className="ig-mould"
        style={{ left: u(MOULD_BOX.x), top: u(MOULD_BOX.y), width: u(MOULD_BOX.w), height: u(MOULD_BOX.h), '--mould': MOULD } as React.CSSProperties}
      >
        <i />
      </div>

      {/* The metal: a heat gradient rising through the dot matrix (and a blurred copy for its glow). */}
      <div className="ig-melt-glow">
        <div className="ig-melt">
          <div className="ig-lvl">
            <i />
          </div>
        </div>
      </div>
      <div className="ig-melt ig-melt-dots">
        <div className="ig-lvl">
          <i />
        </div>
      </div>

      <div className="ig-trickle">
        {TRICKLE.map((mask, i) => (
          <div key={i} style={{ '--tr': mask } as React.CSSProperties}>
            <i />
          </div>
        ))}
      </div>
      <div className="ig-cfill" style={{ left: u(c - core), top: u(c - core), width: u(core * 2), height: u(core * 2) }}>
        <i />
      </div>
      <div className="ig-stream" style={{ left: u(32 - 0.7), top: u(LIP.y), width: u(1.4), height: u(CORE_TOP + 1.5 - LIP.y) }}>
        <div>
          <i />
        </div>
      </div>

      <div className="ig-cru" style={{ left: u(LIP.x + CRU.x * CRU.k), top: u(LIP.y + CRU.y * CRU.k), width: u(CRU.w * CRU.k), height: u(CRU.h * CRU.k) }}>
        <div className="ig-cru-glow" />
        <div className="ig-cru-drop" style={{ clipPath: poly([[-9.15, -80], ...INSIDE.slice(1, -2), [-1.35, -80]]) }}>
          {INGOTS.map(([x, y, rot], i) => (
            <i key={i} style={{ left: cx(x - 1.1), top: cy(y - 1.1), width: `${fx((2.2 / CRU.w) * 100)}%`, rotate: `${rot}deg`, '--n': i } as React.CSSProperties} />
          ))}
        </div>
        <div className="ig-cru-in" style={{ clipPath: poly(INSIDE) }}>
          <div className="ig-pool-r">
            <div className="ig-pool" />
          </div>
        </div>
        <svg className="ig-cru-art" viewBox={`${CRU.x} ${CRU.y} ${CRU.w} ${CRU.h}`}>
          <defs>
            <pattern id="ig-hatch" width="0.55" height="0.55" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <path d="M0 0V0.55" />
            </pattern>
          </defs>
          <path className="ig-cru-wall" d={`${CRU_OUT}${CRU_IN}M-10.6 -0.5H-0.6V0H-10.6Z`} fillRule="evenodd" />
          <path className="ig-cru-line" d={`${CRU_OUT}M-10.6 -0.5H-0.6L0 -0.05L-0.6 0H-10.6Z`} />
          <path className="ig-cru-line ig-cru-inner" d={CRU_IN} />
        </svg>
      </div>

      <div className="ig-sparks">
        {SPARKS.map(([dx, up, dn, ms, dl], i) => (
          <i key={i} style={{ '--dx': dx, '--up': up, '--dn': dn, '--ms': `${ms}ms`, '--dl': `${dl}ms` } as React.CSSProperties} />
        ))}
      </div>
    </div>
  );
}
