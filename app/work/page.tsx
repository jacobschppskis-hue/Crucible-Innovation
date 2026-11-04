import type { Metadata } from 'next';
import { Footer } from '@/components/Footer';
import { ArrowRight } from '@/components/Icons';
import { Nav } from '@/components/Nav';
import { WordReveal } from '@/components/WordReveal';
import { CardPair, ClientFrame, ConceptDevices, MarkMould, MarkSizes, Plate, ShotDevices, type Shot } from '@/components/Work';
import { clientSites, work } from '@/data/work';
import { conceptFonts } from '@/lib/conceptFonts';

const title = 'Work · Crucible';
const description =
  'Everything Crucible has made so far: client sites as they launch, three concept sites built as real pages, this website, the business card and the Split Ring mark.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/work' },
  openGraph: { title, description, url: '/work' },
  twitter: { title, description },
};

// Crucible's own work. Images live in public/work at the listed widths (name-<w>.webp); see components/Work.tsx.
const site: Record<'desktop' | 'phone', Shot> = {
  desktop: {
    src: '/work/crucible-site.webp',
    widths: [960, 1440],
    width: 1440,
    height: 900,
    alt: 'The crucibleinnovation.com home page on a desktop: the Split Ring above the headline “Intelligence, alloyed”.',
  },
  phone: {
    src: '/work/crucible-site-phone.webp',
    widths: [390, 780],
    width: 780,
    height: 1688,
    alt: 'The same home page on a phone.',
  },
};
const card: Record<'front' | 'back', Shot> = {
  front: {
    src: '/work/business-card-front.webp',
    widths: [800, 1344],
    width: 1344,
    height: 768,
    alt: 'Front of the Crucible Sites business card: the Split Ring and the crucible wordmark, and the line “Websites that actually look good.”',
  },
  back: {
    src: '/work/business-card-back.webp',
    widths: [800, 1344],
    width: 1344,
    height: 768,
    alt: 'Back of the card: Jacob Schopp, co-founder, his email and the site address, and a QR code.',
  },
};

export default function WorkPage() {
  const clients = clientSites.length > 0;
  return (
    <>
      <Nav />
      {/* The concept sites bring their own faces (lib/conceptFonts.ts). */}
      <main id="main" className={conceptFonts}>
        <header className="container-x wk-head">
          <WordReveal as="h1" immediate segments={[{ t: 'Work' }]} className="h-display wk-title" />
          {/* Near the top, so it isn't held back for a reveal (it would delay the first paint of real content). */}
          <div className="wk-lede">
            <p>Everything Crucible has made so far.</p>
            {!clients && <p className="mt-3">The first client sites launch soon and will appear here as they go live.</p>}
          </div>
        </header>

        {clients && (
          <section aria-labelledby="clients-h" className="wk-section">
            <div className="container-x wk-group">
              <WordReveal id="clients-h" segments={[{ t: 'Client sites' }]} className="wk-h2" />
            </div>
            <div className="wk-stack">
              {clientSites.map((c, i) => (
                <Plate
                  key={c.slug}
                  i={i}
                  id={`client-${c.slug}`}
                  label={
                    <>
                      <span aria-hidden className="live-dot size-1.5 rounded-full bg-ember" />
                      <span>
                        <span className="text-ember">Live</span> · {c.type}
                      </span>
                    </>
                  }
                  name={c.name}
                  note={
                    <>
                      <p>{c.description}</p>
                      <a href={c.url} target="_blank" rel="noopener" className="vf-link mt-6">
                        Visit the site <ArrowRight />
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </>
                  }
                >
                  <ClientFrame c={c} />
                </Plate>
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="concepts-h" className="wk-section">
          <div className="container-x wk-group">
            <WordReveal id="concepts-h" segments={[{ t: 'Concept sites' }]} className="wk-h2" />
            <p className="wk-group-note">Fictional businesses, built as real pages. The phones scroll.</p>
          </div>
          <div className="wk-stack">
            {work.map((w, i) => (
              <Plate key={w.slug} i={i} id={`concept-${w.slug}`} label={`${w.label} · ${w.type}`} name={w.name} note={<p>{w.blurb}</p>}>
                <ConceptDevices w={w} />
              </Plate>
            ))}
          </div>
        </section>

        <section aria-labelledby="own-h" className="wk-section wk-section-last">
          <div className="container-x wk-group">
            <WordReveal id="own-h" segments={[{ t: 'Crucible’s own' }]} className="wk-h2" />
          </div>
          <div className="wk-stack">
            <Plate
              i={0}
              id="own-site"
              label="Website · Next.js"
              name="This site"
              note={
                <p>
                  It opens with a pour: molten metal fills a mould of the mark and sets. CSS and SVG on every device; WebGL only once a
                  device proves it can keep up.
                </p>
              }
            >
              <ShotDevices host="crucibleinnovation.com" desktop={site.desktop} phone={site.phone} />
            </Plate>
            <Plate
              i={1}
              id="own-card"
              label="Print · 3.5 × 2 in"
              name="Business card"
              note={<p>Front and back. The QR code opens Crucible Sites with a card tag, so every enquiry from a card arrives marked.</p>}
            >
              <CardPair front={card.front} back={card.back} />
            </Plate>
            <Plate
              i={2}
              id="own-mark"
              label="Mark"
              name="The Split Ring"
              note={
                <>
                  <p>
                    A drawn line and a run of machine pixels, exactly as thick as each other, around an Ember core. The same geometry draws
                    the favicon and the share images.
                  </p>
                  <MarkSizes />
                </>
              }
            >
              <MarkMould />
            </Plate>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
