import type { Metadata } from 'next';
import Image from 'next/image';
import { BeforeAfter } from '@/components/BeforeAfter';
import { BrowserFrame } from '@/components/BrowserFrame';
import { Faq } from '@/components/Faq';
import { Footer } from '@/components/Footer';
import { JsonLd } from '@/components/JsonLd';
import { HeatField } from '@/components/HeatField';
import { ArrowRight } from '@/components/Icons';
import { Nav } from '@/components/Nav';
import { PricingCard } from '@/components/PricingCard';
import { Process } from '@/components/Process';
import { QuoteForm } from '@/components/QuoteForm';
import { Reveal } from '@/components/Reveal';
import { SplitRing } from '@/components/SplitRing';
import { SpotlightCard } from '@/components/SpotlightCard';
import { WordReveal, type Segment } from '@/components/WordReveal';
import { packages, pricingNote } from '@/data/pricing';
import { site } from '@/data/site';
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
  const { founder } = site;

  return (
    <>
      <Nav variant="sites" />
      <main id="main">
        {/* 1. Hero */}
        <section className="relative overflow-hidden pt-[calc(var(--nav-h)+3rem)] pb-20 sm:pb-28 lg:flex lg:min-h-[100svh] lg:items-center lg:pt-[var(--nav-h)]">
          <HeatField origin={[0.76, 0.52]} originMobile={[0.5, 0.78]} />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-ground" />
          <div className="container-x relative grid items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
            <div>
              <p className="label">Crucible Sites · Websites for local businesses</p>
              <WordReveal
                as="h1"
                immediate
                className="h-display mt-6 text-[2.625rem] sm:text-6xl xl:text-[4.5rem]"
                segments={[{ t: 'Your business deserves a website that' }, { t: 'actually looks good.', className: 'accent molten text-[1.08em]' }]}
              />
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-bone-dim sm:text-xl">
                We design and build fast, beautiful websites for local businesses. Live in about a week.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <a href="#start" className="btn btn-primary">
                  Get a quote <ArrowRight />
                </a>
                <a href="#work" className="btn btn-ghost">
                  See our work
                </a>
              </div>
            </div>
            <BrowserFrame items={work} />
          </div>
        </section>

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
        <section className="container-x py-24 sm:py-32">
          <SectionHead
            label="Before / After"
            title={[{ t: 'Same business.' }, { t: 'Different decade.', className: 'accent' }]}
            sub="Drag the handle. Same services, same phone number. One of these gets the call."
          />
          <Reveal className="mt-12">
            <BeforeAfter
              before={{ src: '/showcase/before.webp', alt: 'A dated small-business website: tiled background, cramped table layout, tiny blue links and a visitor counter.' }}
              after={{ src: after.image, alt: after.alt }}
            />
            <p className="mt-4 text-sm text-bone-dim">Illustrative mock. Both versions are a fictional business, not a real client.</p>
          </Reveal>
        </section>

        {/* 4. Process */}
        <section id="process" className="container-x pb-24 sm:pb-32">
          <SectionHead label="Process" title={[{ t: 'From first call to live site in' }, { t: 'about a week.', className: 'accent' }]} className="mb-14 sm:mb-20" />
          <Process />
        </section>

        {/* 5. Work */}
        <section id="work" className="container-x pb-24 sm:pb-32">
          <SectionHead
            label="Work"
            title={[{ t: 'A taste of what we' }, { t: 'make.', className: 'accent' }]}
            sub="Concept builds for the kinds of businesses we love working with. Real client work lands here as it ships."
          />
          <ul className="mt-12 grid gap-5 md:grid-cols-3">
            {work.map((w, i) => (
              <Reveal as="li" key={w.slug} delay={i * 0.08}>
                <SpotlightCard as="article" className="group h-full p-2.5">
                  <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-line">
                    <Image
                      src={w.image}
                      alt={w.alt}
                      fill
                      sizes="(min-width: 768px) 33vw, 94vw"
                      className="object-cover object-top transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                    />
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
        <section id="pricing" className="container-x pb-24 sm:pb-32">
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
        </section>

        {/* 7. Who you'll work with */}
        <section aria-labelledby="who" className="container-x pb-24 sm:pb-32">
          <div className="grid items-center gap-10 md:grid-cols-[0.8fr_1fr] md:gap-16">
            <Reveal>
              <div className="relative mx-auto aspect-[4/5] max-w-sm overflow-hidden rounded-2xl border border-line bg-ground-2 shadow-[inset_-1px_0_0_rgba(255,91,31,0.35)] md:max-w-none">
                {founder.photo ? (
                  <Image src={founder.photo} alt={`Portrait of ${founder.name}`} fill sizes="(min-width: 768px) 40vw, 90vw" className="object-cover grayscale contrast-110" />
                ) : (
                  <div className="absolute inset-0 grid place-items-center">
                    <SplitRing size="38%" title="" />
                  </div>
                )}
                {/* faint ember rim light */}
                <div aria-hidden className="absolute inset-0 bg-[radial-gradient(90%_70%_at_105%_40%,rgba(255,91,31,0.18),transparent_60%)] mix-blend-screen" />
              </div>
            </Reveal>
            <div>
              <p className="label">Who you&rsquo;ll work with</p>
              <h2 id="who" className="h-section mt-4">
                Hi, I&rsquo;m {founder.name}.
              </h2>
              {/* TODO(jakob): replace with your own 2–3 sentence bio. */}
              <Reveal>
                <div className="mt-6 max-w-xl space-y-4 text-lg leading-relaxed text-bone-dim">
                  <p>I started Crucible Sites because the businesses that make a town worth living in usually have the worst websites in it.</p>
                  <p>
                    I design and build every site myself, and you talk to me directly, from the first call to launch day. No account managers, no
                    handoffs.
                  </p>
                </div>
                <p className="mt-6 font-serif text-2xl italic text-bone">Talk soon, {founder.firstName}.</p>
                <a href="#start" className="btn btn-ghost mt-8">
                  Talk to me directly <ArrowRight />
                </a>
              </Reveal>
            </div>
          </div>
        </section>

        {/* 8. FAQ */}
        <section id="faq" className="container-x grid gap-10 pb-24 sm:pb-32 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <SectionHead label="FAQ" title={[{ t: 'Questions,' }, { t: 'answered.', className: 'accent' }]} />
          <Faq />
        </section>

        {/* 9. Start a project */}
        <section id="start" className="container-x pb-24 sm:pb-32">
          <div className="grid gap-12 rounded-3xl border border-line bg-ground-2 p-6 sm:p-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 lg:p-14">
            <div>
              <p className="label">Start a project</p>
              <WordReveal segments={[{ t: 'Tell us about your' }, { t: 'business.', className: 'accent' }]} className="h-section mt-4" />
              <p className="mt-5 text-lg leading-relaxed text-bone-dim">
                Takes two minutes. {founder.firstName} reads every message personally and replies within 24 hours.
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
