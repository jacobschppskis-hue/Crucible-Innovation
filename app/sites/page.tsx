import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { BeforeAfter } from '@/components/BeforeAfter';
import { BuildStage } from '@/components/BuildStage';
import { Builders } from '@/components/Builders';
import { Faq } from '@/components/Faq';
import { Footer } from '@/components/Footer';
import { ArrowRight } from '@/components/Icons';
import { JsonLd } from '@/components/JsonLd';
import { Nav } from '@/components/Nav';
import { PricingCard } from '@/components/PricingCard';
import { Process } from '@/components/Process';
import { QuoteForm } from '@/components/QuoteForm';
import { Reveal } from '@/components/Reveal';
import { TryIt } from '@/components/TryIt';
import { WordReveal, type Segment } from '@/components/WordReveal';
import { packages, pricingNote } from '@/data/pricing';
import { work } from '@/data/work';
import { conceptFonts } from '@/lib/conceptFonts';

const title = 'Crucible Sites: websites for local businesses';
const description = 'We design and build fast, beautiful websites for local businesses. Live in about a week. No payment until you’ve approved the design.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/sites' },
  openGraph: { title, description, url: '/sites' },
  twitter: { title, description },
};

// `label` is accepted for old call sites but no longer shown: sections don't get eyebrows.
function SectionHead({ title, sub, className = '' }: { label?: string; title: Segment[]; sub?: string; className?: string }) {
  return (
    <div className={`max-w-3xl ${className}`}>
      <WordReveal segments={title} className="h-section" />
      {sub && (
        <Reveal>
          <p className="mt-5 text-lg leading-relaxed text-bone-dim">{sub}</p>
        </Reveal>
      )}
    </div>
  );
}

export default function SitesPage() {
  const after = work.find((w) => w.slug === 'landscaper')!;

  return (
    <>
      <Nav variant="sites" />
      <main id="main" className={conceptFonts}>
        {/* 1. Hero + first scroll: a live concept site is cast, turns into a phone, and is recast */}
        <BuildStage />

        {/* 2. Try it with your business: the live concept, recast with the visitor's own name */}
        <TryIt />

        {/* 3. Before / After */}
        <section className="cv-auto container-x py-24 sm:py-32" style={{ '--h-sm': '760px', '--h-lg': '1250px' } as React.CSSProperties}>
          <SectionHead
            title={[{ t: 'Same business, different decade' }]}
            sub="Drag the handle. Same services, same phone number. One of these gets the call."
          />
          <div data-scroll="enter" className="tilt-in mt-12">
            <BeforeAfter
              before={{ src: '/showcase/before.webp', alt: 'A dated small-business website: tiled background, cramped table layout, tiny blue links and a visitor counter.' }}
              after={{ src: after.image, alt: after.alt }}
            />
            <p className="mt-4 text-sm text-bone-dim">Illustrative mock. Both versions are a fictional business, not a real client.</p>
          </div>
        </section>

        {/* 4. Process: seven days you can scrub (pinned; no cv-auto, its height depends on whether it pins) */}
        <section id="process" aria-labelledby="process-h" className="days-section pb-24 sm:pb-32">
          <div className="container-x">
            <WordReveal as="h2" id="process-h" segments={[{ t: 'From first call to live site in about a week' }]} className="h-section max-w-[16ch]" />
          </div>
          <Process />
        </section>

        {/* 5. Work */}
        <section id="work" className="cv-auto container-x pb-24 sm:pb-32" style={{ '--h-sm': '1450px', '--h-lg': '710px' } as React.CSSProperties}>
          <SectionHead
            title={[{ t: 'Think in kelvin' }]}
            sub="Measure from absolute zero, not from where everyone else starts. Every concept here began as a blank page. Real client work lands here as it ships."
          />
          <ul className="mt-14 grid gap-x-6 gap-y-14 md:grid-cols-3">
            {work.map((w, i) => (
              <Reveal as="li" key={w.slug} delay={i * 0.08}>
                <article className="group">
                  <div data-scroll="view" data-pull="10" className="parallax relative aspect-[16/10] overflow-hidden bg-ground-2">
                    <div className="parallax-inner absolute inset-0">
                      <Image src={w.image} alt={w.alt} fill sizes="(min-width: 768px) 33vw, 94vw" className="object-cover object-top transition-transform duration-[1200ms] ease-[var(--ease-out)] group-hover:scale-[1.03]" />
                    </div>
                  </div>
                  <h3 className="wide mt-5 font-display text-xl font-semibold tracking-[-0.01em]">{w.name}</h3>
                  <p className="mt-1 text-bone-dim">
                    {w.type}. {w.blurb} <span className="text-bone">{w.label}</span>
                  </p>
                </article>
              </Reveal>
            ))}
          </ul>
          <Link href="/work" className="vf-link mt-12">
            Browse the concept sites <ArrowRight />
          </Link>
        </section>

        {/* 6. Pricing */}
        <section id="pricing" className="cv-auto container-x pb-24 sm:pb-32" style={{ '--h-sm': '2120px', '--h-lg': '1100px' } as React.CSSProperties}>
          <SectionHead title={[{ t: 'Simple packages, honest quotes' }]} sub="Pick a starting point. Every quote is tailored to your business." />
          <ul className="mt-14 grid gap-14 lg:grid-cols-3 lg:gap-10">
            {packages.map((p, i) => (
              <Reveal as="li" key={p.id} delay={i * 0.08}>
                <PricingCard pkg={p} />
              </Reveal>
            ))}
          </ul>
          <p className="mt-12 text-bone-dim">{pricingNote}</p>
          <Reveal className="mt-28 max-w-2xl">
            <p className="h-display text-4xl sm:text-6xl">Entropy is the default</p>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-bone-dim">
              Order only lasts where someone keeps spending energy. That is what monthly care is for.
            </p>
          </Reveal>
        </section>

        {/* 7. Who you'll work with (data/team.ts) */}
        <Builders />

        {/* 8. FAQ */}
        <section id="faq" className="cv-auto container-x grid gap-10 pb-24 sm:pb-32 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16" style={{ '--h-sm': '670px', '--h-lg': '600px' } as React.CSSProperties}>
          <SectionHead title={[{ t: 'Questions, answered' }]} />
          <Faq />
        </section>

        {/* 9. Start a project */}
        <section id="start" aria-labelledby="start-h" className="cv-auto container-x pt-8 pb-28 sm:pt-16 sm:pb-40" style={{ '--h-sm': '620px', '--h-lg': '530px' } as React.CSSProperties}>
          <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
            <div>
              <WordReveal id="start-h" segments={[{ t: 'Tell us about your business' }]} className="h-section qf-head" />
              <p className="mt-6 max-w-sm text-lg leading-relaxed text-bone-dim">It takes two minutes. A real person reads every request and replies within 24 hours.</p>
            </div>
            <QuoteForm />
          </div>
        </section>
      </main>
      <Footer />
      <JsonLd page="sites" />
    </>
  );
}
