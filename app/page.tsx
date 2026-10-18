import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/Footer';
import { JsonLd } from '@/components/JsonLd';
import { HeatField } from '@/components/HeatField';
import { ArrowRight } from '@/components/Icons';
import { KelvinCounter } from '@/components/KelvinCounter';
import { Nav } from '@/components/Nav';
import { Reveal } from '@/components/Reveal';
import { SplitRing } from '@/components/SplitRing';
import { SpotlightCard } from '@/components/SpotlightCard';
import { WordReveal } from '@/components/WordReveal';
import { ventures, ventureHref } from '@/data/ventures';

export const metadata: Metadata = {
  title: 'Crucible: a studio that ships ventures',
  alternates: { canonical: '/' },
  openGraph: { title: 'Crucible', description: 'Crucible is a studio that builds and ships ventures.', url: '/' },
};

export default function Home() {
  const live = ventures.filter((v) => v.status === 'live').length;
  return (
    <>
      <Nav variant="home" />
      <main id="main">
        {/* Hero */}
        <section className="relative flex min-h-[100svh] items-center overflow-hidden pt-[var(--nav-h)]">
          <HeatField origin={[0.5, 0.36]} />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-ground" />
          <div className="container-x relative flex flex-col items-center py-16 text-center">
            <SplitRing animated size="clamp(7.5rem, 22vw, 12rem)" />
            <WordReveal
              as="h1"
              immediate
              delayMs={250}
              className="h-display mt-12 max-w-4xl text-[2.625rem] sm:text-6xl lg:text-7xl"
              segments={[{ t: 'Exceptional people. Serious machines.' }, { t: 'New things.', className: 'accent text-[1.08em]' }]}
            />
            <p className="mt-6 max-w-md text-lg text-bone-dim sm:text-xl">Crucible is a studio that builds and ships ventures.</p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link href="/sites" className="btn btn-primary">
                See Crucible Sites <ArrowRight />
              </Link>
              <a href="#ventures" className="btn btn-ghost">
                Our ventures
              </a>
            </div>
          </div>
        </section>

        {/* Ventures */}
        <section id="ventures" className="container-x py-24 sm:py-32">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl">
              <p className="label">Ventures</p>
              <WordReveal segments={[{ t: 'One live.' }, { t: 'More in the furnace.', className: 'accent' }]} className="h-section mt-4" />
            </div>
            <p className="label">
              {String(live).padStart(2, '0')} live · {String(ventures.length - live).padStart(2, '0')} forging
            </p>
          </div>
          <ul className="mt-12 grid gap-5 md:grid-cols-3">
            {ventures.map((v, i) => (
              <Reveal as="li" key={v.slug} delay={i * 0.08}>
                {v.status === 'live' ? (
                  <SpotlightCard as="article" className="group relative flex h-full min-h-72 flex-col p-7">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-ember">
                        <span aria-hidden className="size-1.5 rounded-full bg-ember" />
                        Live
                      </span>
                      <ArrowRight className="size-5 text-bone-dim transition-transform duration-300 group-hover:translate-x-1 group-hover:text-bone" />
                    </div>
                    <h3 className="mt-auto pt-16 font-display text-3xl font-semibold tracking-[-0.025em]">
                      <Link href={ventureHref(v)} className="rounded-md after:absolute after:inset-0 after:rounded-[1.25rem]">
                        {v.name}
                      </Link>
                    </h3>
                    <p className="mt-3 text-bone-dim">{v.blurb}</p>
                  </SpotlightCard>
                ) : (
                  <article className="flex h-full min-h-72 flex-col rounded-[1.25rem] border border-dashed border-line-strong p-7">
                    <span className="font-mono text-xs uppercase tracking-[0.14em] text-bone-dim">Forging</span>
                    <h3 className="mt-auto pt-16 font-display text-3xl font-semibold tracking-[-0.025em] text-bone-dim">Next venture</h3>
                    <p className="mt-3 text-bone-dim">{v.blurb}</p>
                  </article>
                )}
              </Reveal>
            ))}
          </ul>
        </section>

        {/* Thesis */}
        <section aria-label="Thesis" className="border-y border-line">
          <div className="container-x flex flex-col gap-10 py-24 sm:py-32 lg:flex-row lg:items-end lg:justify-between">
            <Reveal>
              <p className="max-w-4xl font-serif-upright text-[2.75rem] leading-[1.02] tracking-[-0.015em] text-balance sm:text-7xl lg:text-[5.75rem]">
                An alloy is stronger than its metals.
              </p>
            </Reveal>
            <div className="shrink-0 border-l border-line pl-5 lg:mb-3">
              <p className="label">Fe · Melting point</p>
              <p className="mt-2 text-4xl text-bone sm:text-5xl">
                <KelvinCounter />
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <JsonLd page="home" />
    </>
  );
}
