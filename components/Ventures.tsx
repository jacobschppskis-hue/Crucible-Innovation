import Link from 'next/link';
import { RING, arcPath, pixels } from '@/lib/splitRing';
import { ventures, ventureHref } from '@/data/ventures';
import { ArrowRight } from './Icons';
import { LiveSite } from './LiveSite';
import { Reveal } from './Reveal';
import { SpotlightCard } from './SpotlightCard';
import { WordReveal } from './WordReveal';

/** A Split Ring still in the furnace: part of each arc drawn, a few pixels set, the core not lit yet. */
function Forging({ progress }: { progress: number }) {
  const { c, px, stroke, rings } = RING;
  return (
    <svg aria-hidden viewBox="0 0 64 64" className="forging-mark">
      {rings.map(({ r, n }) => (
        <g key={r}>
          <path d={arcPath(r)} pathLength={1} fill="none" stroke="currentColor" strokeWidth={stroke} strokeDasharray={`${progress} 2`} />
          {pixels(r, n)
            .slice(0, Math.round(n * progress * 0.7))
            .map(({ x, y, deg }, i) => (
              <rect key={i} x={x - px / 2} y={y - px / 2} width={px} height={px} fill="currentColor" transform={`rotate(${deg} ${x} ${y})`} />
            ))}
        </g>
      ))}
      <circle className="forging-core" cx={c} cy={c} r={RING.core} />
    </svg>
  );
}

/** Ventures: the live one shows a concept site being cast as it scrolls in; the rest are still being forged. */
export function Ventures() {
  const live = ventures.filter((v) => v.status === 'live').length;
  let forging = 0;
  return (
    <section id="ventures" className="container-x py-24 sm:py-32">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <p className="label">Ventures</p>
          <WordReveal segments={[{ t: 'Everything new was once' }, { t: 'molten.', className: 'accent' }]} className="h-section mt-4" />
        </div>
        <p className="label">
          {String(live).padStart(2, '0')} live · {String(ventures.length - live).padStart(2, '0')} forging
        </p>
      </div>
      <ul className="mt-12 grid gap-5 md:grid-cols-3">
        {ventures.map((v, i) => (
          <Reveal as="li" key={v.slug} delay={i * 0.08}>
            {v.status === 'live' ? (
              <SpotlightCard as="article" tilt className="group relative flex h-full min-h-72 flex-col p-2.5">
                <div data-cast="" aria-hidden className="ls-vp relative aspect-[16/10] overflow-hidden rounded-xl border border-line bg-ground">
                  <div className="cast-in">
                    <LiveSite theme="cafe" blueprint />
                  </div>
                  <div className="cast-layer cast-piece">
                    <div className="cast-in">
                      <LiveSite theme="cafe" />
                    </div>
                  </div>
                  <div className="cast-track">
                    <div className="cast-band" />
                    <div className="cast-front" />
                  </div>
                  <span className="venture-concept">Concept</span>
                </div>
                <div className="flex flex-1 flex-col px-4.5 pb-4.5 pt-6">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-ember">
                      <span aria-hidden className="live-dot size-1.5 rounded-full bg-ember" />
                      Live
                    </span>
                    <ArrowRight className="size-5 text-bone-dim transition-transform duration-500 ease-[var(--ease-spring)] group-hover:translate-x-1 group-hover:text-bone" />
                  </div>
                  <h3 className="mt-auto pt-8 font-display text-3xl font-semibold tracking-[-0.025em]">
                    <Link href={ventureHref(v)} className="rounded-md after:absolute after:inset-0 after:rounded-[1.25rem]">
                      {v.name}
                    </Link>
                  </h3>
                  <p className="mt-3 text-bone-dim">{v.blurb}</p>
                </div>
              </SpotlightCard>
            ) : (
              <article className="forging relative flex h-full min-h-72 flex-col overflow-hidden rounded-[1.25rem] border border-dashed border-line-strong p-7">
                <span className="font-mono text-xs uppercase tracking-[0.14em] text-bone-dim">Forging</span>
                <div className="grid flex-1 place-items-center py-8">
                  <Forging progress={++forging === 1 ? 0.62 : 0.3} />
                </div>
                <h3 className="font-display text-3xl font-semibold tracking-[-0.025em] text-bone-dim">Next venture</h3>
                <p className="mt-3 text-bone-dim">{v.blurb}</p>
              </article>
            )}
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
