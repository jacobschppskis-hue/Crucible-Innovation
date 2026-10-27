import type { Metadata } from 'next';
import Image from 'next/image';
import { BeforeAfter } from '@/components/BeforeAfter';
import { BuildStage } from '@/components/BuildStage';
import { Builders } from '@/components/Builders';
import { Faq } from '@/components/Faq';
import { Footer } from '@/components/Footer';
import { JsonLd } from '@/components/JsonLd';
import { LiveSite, isTheme } from '@/components/LiveSite';
import { Nav } from '@/components/Nav';
import { PricingCard } from '@/components/PricingCard';
import { Process } from '@/components/Process';
import { QuoteForm } from '@/components/QuoteForm';
import { Reveal } from '@/components/Reveal';
import { SpotlightCard } from '@/components/SpotlightCard';
import { WordReveal, type Segment } from '@/components/WordReveal';
import { packages, pricingNote } from '@/data/pricing';
import { work } from '@/data/work';

const title = 'Crucible Sites: websites for local businesses';
const description = 'We design and build fast, beautiful websites for local businesses. Live in about a week. No payment until you’ve approved the design.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/sites' },
  openGraph: { title, description, url: '/sites' },
  twitter: { title, description },
};

const promises = ['~7 days to launch', 'Mobile-first', 'You own it', 'No payment until you approve'];

function SectionHead({ label, title, sub, className = '' }: { label: string; title: Segment[]; sub?: string; className?: string }) {
  return (
    <div className={`max-w-2xl ${className}`}>
      <p className="label">{label}</p>
      <WordReveal segments={title} className="h-section mt-4" />
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
      <main id="main">
        {/* 1. Hero + first scroll: a live concept site is cast, turns into a phone, and is recast */}
        <BuildStage />

        {/* 2. Proof bar: promises, not invented numbers */}
        <section aria-label="What you can count on" className="border-y border-line">
          <ul className="container-x grid gap-x-4 gap-y-3 py-6 sm:grid-cols-2 font-mono text-[0.75rem] uppercase tracking-[0.14em] text-bone sm:text-[0.8125rem] lg:flex lg:justify-between">
            {promises.map((p) => (
              <li key={p} className="flex items-center gap-3">
                <span aria-hidden className="size-1 rounded-full bg-bone/40" />
                {p}
              </li>
            ))}
          </ul>
        </section>

        {/* 3. Before / After */}
        <section className="cv-auto container-x py-24 sm:py-32">
          <SectionHead
            label="Before / After"
            title={[{ t: 'Same business.' }, { t: 'Different decade.', className: 'accent' }]}
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

        {/* 4. Process */}
        <section id="process" className="cv-auto container-x pb-24 sm:pb-32">
          <SectionHead label="Process" title={[{ t: 'From first call to live site in' }, { t: 'about a week.', className: 'accent' }]} className="mb-14 sm:mb-20" />
          <Process />
        </section>

        {/* 5. Work */}
        <section id="work" className="cv-auto container-x pb-24 sm:pb-32">
          <SectionHead
            label="Work"
            title={[{ t: 'Think in' }, { t: 'kelvin.', className: 'accent' }]}
            sub="Measure from absolute zero, not from where everyone else starts. Every concept here began as a blank page, not a template. Real client work lands here as it ships."
          />
          <ul className="mt-12 grid gap-5 md:grid-cols-3">
            {work.map((w, i) => (
              <Reveal as="li" key={w.slug} delay={i * 0.08}>
                <SpotlightCard as="article" tilt className="group h-full p-2.5">
                  <div data-scroll="view" className="parallax relative aspect-[16/10] overflow-hidden rounded-xl border border-line">
                    {isTheme(w.slug) ? (
                      // Concepts are live HTML (components/LiveSite.tsx): hover the buttons, the coffee turns, the pole spins.
                      <div role="img" aria-label={w.alt} className="parallax-inner ls-vp absolute inset-0">
                        {/* the parallax layer overscans by 8% top and bottom; keep the site's nav in the frame */}
                        <div aria-hidden className="absolute inset-x-0 bottom-0 top-[7%]">
                          <LiveSite theme={w.slug} />
                        </div>
                      </div>
                    ) : (
                      <div className="parallax-inner absolute inset-0">
                        <Image src={w.image} alt={w.alt} fill sizes="(min-width: 768px) 33vw, 94vw" className="object-cover object-top" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-start justify-between gap-4 px-3 pb-3 pt-5">
                    <div>
                      <p className="label">{w.type}</p>
                      <h3 className="mt-2 font-display text-lg font-semibold tracking-[-0.01em]">{w.name}</h3>
                      <p className="mt-1 text-sm text-bone-dim">{w.blurb}</p>
                    </div>
                    <span className="label shrink-0 rounded-full border border-line-strong px-2.5 py-1 text-bone">{w.label}</span>
                  </div>
                </SpotlightCard>
              </Reveal>
            ))}
          </ul>
        </section>

        {/* 6. Pricing */}
        <section id="pricing" className="cv-auto container-x pb-24 sm:pb-32">
          <SectionHead
            label="Pricing"
            title={[{ t: 'Simple packages.' }, { t: 'Honest prices.', className: 'accent' }]}
            sub="Pick a starting point. Every quote is tailored to your business."
          />
          <ul className="mt-12 grid gap-5 lg:grid-cols-3">
            {packages.map((p, i) => (
              <Reveal as="li" key={p.id} delay={i * 0.08}>
                <PricingCard pkg={p} />
              </Reveal>
            ))}
          </ul>
          <p className="mt-8 text-center text-bone-dim">{pricingNote}</p>
          <Reveal className="mx-auto mt-20 max-w-xl text-center">
            <p className="font-serif-upright text-4xl leading-tight text-bone sm:text-5xl">
              Entropy is the <span className="accent">default.</span>
            </p>
            <p className="mt-4 font-mono text-xs leading-relaxed text-balance text-bone-dim">
              Order only lasts where someone keeps spending energy. That is what monthly care is for.
            </p>
          </Reveal>
        </section>

        {/* 7. Who you'll work with (data/team.ts) */}
        <Builders />

        {/* 8. FAQ */}
        <section id="faq" className="cv-auto container-x grid gap-10 pb-24 sm:pb-32 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <SectionHead label="FAQ" title={[{ t: 'Questions,' }, { t: 'answered.', className: 'accent' }]} />
          <Faq />
        </section>

        {/* 9. Start a project */}
        <section id="start" className="cv-auto container-x pb-24 sm:pb-32">
          <div className="grid gap-12 rounded-3xl border border-line bg-ground-2 p-6 sm:p-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 lg:p-14">
            <div>
              <p className="label">Start a project</p>
              <WordReveal segments={[{ t: 'Tell us about your' }, { t: 'business.', className: 'accent' }]} className="h-section mt-4" />
              <p className="mt-5 text-lg leading-relaxed text-bone-dim">
                Takes two minutes. A real person reads every request, and you’ll hear back within 24 hours.
              </p>
              <ul className="mt-8 space-y-3 font-mono text-[0.8125rem] uppercase tracking-[0.12em] text-bone-dim">
                <li>→ A real person, not a sales team</li>
                <li>→ A reply within 24 hours</li>
                <li>→ No payment until you approve</li>
              </ul>
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
