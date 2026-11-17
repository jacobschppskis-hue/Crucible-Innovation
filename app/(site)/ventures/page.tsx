import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/Footer';
import { ArrowRight } from '@/components/Icons';
import { Nav } from '@/components/Nav';
import { Reveal } from '@/components/Reveal';
import { VentureObject, cueFor } from '@/components/Ventures';
import { WordReveal } from '@/components/WordReveal';
import { ventures, ventureHref, type Venture } from '@/data/ventures';
import '@/components/VenturePages.css';

const all = ventures as readonly Venture[];
const live = all.filter((v) => v.status === 'live');
const forging = all.filter((v) => v.status !== 'live');

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five'];
const count = (n: number) => WORDS[n] ?? String(n);
const lede = `What Crucible is building. ${count(live.length)} ${live.length === 1 ? 'is' : 'are'} live${
  forging.length ? `; ${count(forging.length).toLowerCase()} ${forging.length === 1 ? 'is' : 'are'} still in the mould` : ''
}.`;

const title = 'Ventures · Crucible';
const description = `What Crucible is building: ${live.map((v) => v.name).join(', ')} live${
  forging.length ? `; ${forging.map((v) => v.name).join(' and ')} coming soon` : ''
}.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/ventures' },
  openGraph: { title, description, url: '/ventures' },
  twitter: { title, description },
};

/**
 * Every venture, as the foundry floor shows them (components/Ventures.tsx): what has set and cooled first, at full
 * size; what is still glowing in its mould after it, side by side.
 */
export default function VenturesPage() {
  return (
    <>
      <Nav />
      <main id="main">
        <header className="container-x vx-head">
          <WordReveal as="h1" immediate segments={[{ t: 'Ventures' }]} className="h-display vx-title" />
          <p className="vx-lede">{lede}</p>
        </header>

        <div className="container-x vx-floor">
          {live.map((v) => (
            <article key={v.slug} aria-labelledby={`v-${v.slug}`} className="vx-live group">
              <Link href={ventureHref(v)} tabIndex={-1} aria-hidden className="vx-visual">
                <VentureObject v={v} sizes="(min-width: 1024px) 56vw, 92vw" cue={cueFor(v)} />
              </Link>
              {/* In the first screen, so not held back for a reveal. */}
              <div className="vx-text">
                <p className="label flex items-center gap-2 text-ember">
                  <span aria-hidden className="live-dot size-1.5 rounded-full bg-ember" />
                  Live
                </p>
                <h2 id={`v-${v.slug}`} className="vf-name">
                  {v.name}
                </h2>
                <p className="vx-blurb">{v.tagline ? `${v.tagline}. ${v.blurb}` : v.blurb}</p>
                <Link href={ventureHref(v)} className="vf-link mt-8">
                  See {v.name} <ArrowRight />
                </Link>
              </div>
            </article>
          ))}

          {forging.length > 0 && (
            <div className="vx-next">
              {forging.map((v, i) => (
                <article key={v.slug} aria-labelledby={`v-${v.slug}`} data-hot="" className="vx-forging group">
                  <Link href={ventureHref(v)} tabIndex={-1} aria-hidden className="vx-visual">
                    <VentureObject v={v} sizes="(min-width: 1024px) 44vw, 92vw" cue={cueFor(v)} />
                  </Link>
                  <Reveal className="vx-text" delay={i * 0.08}>
                    <p className="label">Coming soon</p>
                    <h2 id={`v-${v.slug}`} className="vx-name-sm">
                      {v.name}
                    </h2>
                    {v.tagline && <p className="vx-tag">{v.tagline}</p>}
                    <p className="vx-blurb">{v.blurb}</p>
                    <Link href={ventureHref(v)} className="vf-link mt-7">
                      About {v.name} <ArrowRight />
                    </Link>
                  </Reveal>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
