import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/Footer';
import { Ignition } from '@/components/Ignition';
import { JsonLd } from '@/components/JsonLd';
import { ArrowRight } from '@/components/Icons';
import { Nav } from '@/components/Nav';
import { Reveal } from '@/components/Reveal';
import { Story } from '@/components/Story';
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
        {/* The opening: ignition on load, then the ring comes apart and fuses as you scroll */}
        <Ignition />
        {/* Jacob's story: why Crucible exists and where the name comes from */}
        <Story />

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

        <Thesis />
      </main>
      <Footer />
      <JsonLd page="home" />
    </>
  );
}
