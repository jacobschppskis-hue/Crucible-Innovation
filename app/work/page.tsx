import type { Metadata } from 'next';
import { Footer } from '@/components/Footer';
import { ArrowRight } from '@/components/Icons';
import { Nav } from '@/components/Nav';
import { WordReveal } from '@/components/WordReveal';
import {
  CardPair,
  ClientFilm,
  ClientFrame,
  ConceptDevices,
  MarkPlate,
  Plate,
  ShotDevices,
  Stack,
  filmPlates,
  type CardSide,
  type Shot,
} from '@/components/Work';
import { clientSites, work } from '@/data/work';
import { conceptFonts } from '@/lib/conceptFonts';
import '@/components/Ventures.css'; // .vf-link and .vf-mould, shared with the venture pages
// The card as printed: the renders of brand/business-card.html (`node brand/render-card.mjs`), so /work follows the card.
import cardBack from '@/brand/business-card-back.png';
import cardFront from '@/brand/business-card-front.png';

// The nav calls the page "Work"; its headline is "Out of the crucible". Live client work leads, then the concepts,
// then what Crucible made for itself.
const live = clientSites.map((c) => c.name);
const title = 'Out of the crucible: work by Crucible';
const description = `${
  live.length ? `Live client work (${live.join(', ')}), then` : 'Client sites as they launch,'
} three concept sites built as real pages, and Crucible’s own website, business card and mark.`;

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
    alt: 'The crucibleinnovation.com home page on a desktop: the mark hung round a glowing sun over a molten sea, and the headline “Intelligence, alloyed”.',
  },
  phone: {
    src: '/work/crucible-site-phone.webp',
    widths: [390, 780],
    width: 780,
    height: 1688,
    alt: 'The same home page on a phone.',
  },
};
const card: Record<'front' | 'back', CardSide> = {
  front: {
    src: cardFront,
    alt: 'Front of the Crucible Sites business card: the Split Ring beside the wordmark “crucible sites”, and the line “Websites that actually look good. For local businesses. Live in about a week.”',
  },
  back: {
    src: cardBack,
    alt: 'Back of the card: Jacob Schopp, co-founder of Crucible Sites, his email and the site address, and a QR code to scan for examples and a free quote.',
  },
};

export default function WorkPage() {
  const clients = clientSites.length > 0;
  // A client site that can't be embedded plays as a film and holds its plate for it (components/Work.tsx).
  const stack = filmPlates(clientSites);
  return (
    <>
      <Nav />
      {/* The concept sites bring their own faces (lib/conceptFonts.ts). */}
      <main id="main" className={conceptFonts}>
        <header className="container-x wk-head">
          <WordReveal as="h1" immediate segments={[{ t: 'Out of the' }, { br: true }, { t: 'crucible' }]} className="h-display wk-title" />
          {/* Near the top, so it isn't held back for a reveal (it would delay the first paint of real content). */}
          <div className="wk-lede">
            {clients ? (
              <>
                <p>
                  Live client work comes first: <span className="text-bone">{live.join(', ')}</span>,{' '}
                  {live.length > 1 ? 'sites' : 'a site'} you can visit today.
                </p>
                <p className="mt-3">Then three concept sites built as real pages, and what Crucible made for itself.</p>
              </>
            ) : (
              <>
                <p>Three concept sites built as real pages, and what Crucible made for itself.</p>
                <p className="mt-3">The first client sites launch soon and will appear here as they go live.</p>
              </>
            )}
          </div>
        </header>

        {clients && (
          <section aria-labelledby="clients-h" className="wk-section">
            <div className="container-x wk-group">
              <WordReveal id="clients-h" segments={[{ t: 'Client work' }]} className="wk-h2" />
            </div>
            <Stack n={stack.n}>
              {stack.plates.map(({ c, at, film }, i) => (
                <Plate
                  key={c.slug}
                  i={i}
                  at={at}
                  film={film}
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
                  {c.moments?.length && !c.embed ? <ClientFilm c={c} /> : <ClientFrame c={c} />}
                </Plate>
              ))}
            </Stack>
          </section>
        )}

        <section aria-labelledby="concepts-h" className="wk-section">
          <div className="container-x wk-group">
            <WordReveal id="concepts-h" segments={[{ t: 'Concept sites' }]} className="wk-h2" />
            <p className="wk-group-note">Fictional businesses, built as real pages. The phones scroll.</p>
          </div>
          <Stack n={work.length}>
            {work.map((w, i) => (
              <Plate key={w.slug} i={i} id={`concept-${w.slug}`} label={`${w.label} · ${w.type}`} name={w.name} note={<p>{w.blurb}</p>}>
                <ConceptDevices w={w} />
              </Plate>
            ))}
          </Stack>
        </section>

        <section aria-labelledby="own-h" className="wk-section wk-section-last">
          <div className="container-x wk-group">
            <WordReveal id="own-h" segments={[{ t: 'Crucible’s own' }]} className="wk-h2" />
          </div>
          <Stack n={3}>
            <Plate
              i={0}
              id="own-site"
              label="Website · Next.js"
              name="This site"
              note={
                <p>
                  The home page is one lap round a molten planet: a day passes as you scroll, and the bottom of the page flows back into
                  the top. Real-time WebGL, with a still version for reduced motion.
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
                <p>
                  A drawn line and a run of machine pixels, exactly as thick as each other, around an Ember core. The same geometry draws the
                  favicon and the share images.
                </p>
              }
            >
              <MarkPlate />
            </Plate>
          </Stack>
        </section>
      </main>
      <Footer />
    </>
  );
}
