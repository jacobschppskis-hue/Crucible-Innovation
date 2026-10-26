import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/Footer';
import { FusionStory } from '@/components/FusionStory';
import { JsonLd } from '@/components/JsonLd';
import { HeatField } from '@/components/HeatField';
import { ArrowRight } from '@/components/Icons';
import { Nav } from '@/components/Nav';
import { Reveal } from '@/components/Reveal';
import { SayingsGallery } from '@/components/SayingsGallery';
import { SplitRing } from '@/components/SplitRing';
import { SpotlightCard } from '@/components/SpotlightCard';
import { Thesis } from '@/components/Thesis';
import { WordReveal } from '@/components/WordReveal';
import { ventures, ventureHref } from '@/data/ventures';

export const metadata: Metadata = {
  title: 'Crucible: Intelligence, alloyed.',
  description: 'Crucible is a studio that builds and ships ventures. Human judgment and machine range, fused into one material.',
  alternates: { canonical: '/' },
  openGraph: { title: 'Crucible', description: 'Intelligence, alloyed. A studio that builds and ships ventures.', url: '/' },
};

export default function Home() {
  const live = ventures.filter((v) => v.status === 'live').length;
  return (
    <>
      <Nav variant="home" />
      <main id="main">
        {/* Hero: content drifts up and the ring swells as you scroll away */}
        <section data-scroll="view" className="hero-out relative flex min-h-[100svh] items-center overflow-hidden pt-[var(--nav-h)]">
          <HeatField origin={[0.5, 0.36]} />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-ground" />
          <div className="container-x relative flex flex-col items-center py-16 text-center">
            <div className="hero-out-ring">
              <SplitRing animated size="clamp(7.5rem, 22vw, 12rem)" />
            </div>
            <div className="hero-out-copy flex flex-col items-center">
              <WordReveal
                as="h1"
                immediate
                delayMs={250}
                className="h-display mt-12 text-[3.25rem] sm:text-7xl lg:text-[6.5rem]"
                segments={[{ t: 'Intelligence,' }, { t: 'alloyed.', className: 'accent text-[1.08em]' }]}
              />
              <p className="mt-6 max-w-md text-lg text-bone-dim sm:text-xl">
                Human judgment and machine range, fused into one material. Crucible is a studio that builds and ships ventures.
              </p>
              <div className="mt-10 flex flex-wrap justify-center gap-3">
                <Link href="/sites" className="btn btn-primary">
                  See Crucible Sites <ArrowRight />
                </Link>
                <a href="#ventures" className="btn btn-ghost">
                  Our ventures
                </a>
              </div>
            </div>
          </div>
          <div aria-hidden className="scroll-cue absolute bottom-8 left-1/2 h-10 w-px -translate-x-1/2 overflow-hidden bg-line-strong">
            <span className="block h-1/2 w-full bg-bone" />
          </div>
        </section>

        {/* The ring assembles itself as you scroll */}
        <FusionStory />

        {/* Ventures */}
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
                  <SpotlightCard as="article" tilt className="group relative flex h-full min-h-72 flex-col p-7">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-ember">
                        <span aria-hidden className="live-dot size-1.5 rounded-full bg-ember" />
                        Live
                      </span>
                      <ArrowRight className="size-5 text-bone-dim transition-transform duration-500 ease-[var(--ease-spring)] group-hover:translate-x-1 group-hover:text-bone" />
                    </div>
                    <h3 className="mt-auto pt-16 font-display text-3xl font-semibold tracking-[-0.025em]">
                      <Link href={ventureHref(v)} className="rounded-md after:absolute after:inset-0 after:rounded-[1.25rem]">
                        {v.name}
                      </Link>
                    </h3>
                    <p className="mt-3 text-bone-dim">{v.blurb}</p>
                  </SpotlightCard>
                ) : (
                  <article className="forging flex h-full min-h-72 flex-col rounded-[1.25rem] border border-dashed border-line-strong p-7">
                    <span className="font-mono text-xs uppercase tracking-[0.14em] text-bone-dim">Forging</span>
                    <h3 className="mt-auto pt-16 font-display text-3xl font-semibold tracking-[-0.025em] text-bone-dim">Next venture</h3>
                    <p className="mt-3 text-bone-dim">{v.blurb}</p>
                  </article>
                )}
              </Reveal>
            ))}
          </ul>
        </section>

        <SayingsGallery />

        <Thesis />
      </main>
      <Footer />
      <JsonLd page="home" />
    </>
  );
}
