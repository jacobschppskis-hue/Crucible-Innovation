import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { MarkCast } from '@/components/Ventures';
import { WordReveal } from '@/components/WordReveal';
import { site } from '@/data/site';
import { ventures, type Venture } from '@/data/ventures';

// One page per venture that doesn't have its own route (no `href` in data/ventures.ts): live ones, and teasers for the
// ones still in the mould.
const pages = (ventures as readonly Venture[]).filter((v) => !v.href);

export const dynamicParams = false;
// A static export needs at least one param; with no such ventures yet, a placeholder renders the 404.
export const generateStaticParams = () => (pages.length ? pages.map(({ slug }) => ({ slug })) : [{ slug: 'none' }]);

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const v = pages.find((p) => p.slug === slug);
  if (!v) return {};
  const title = `${v.name} · Crucible`;
  const description = v.tagline ? `${v.tagline}. ${v.blurb}` : v.blurb;
  const url = `/ventures/${v.slug}`;
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url }, twitter: { title, description } };
}

/**
 * A venture's own page. While it is still forging this is a teaser: the name, its line, its mark glowing in the mould,
 * Jacob's description (never edited) and a way to hear when it ships. No dates, users or numbers until they are real.
 */
export default async function VenturePage({ params }: Props) {
  const { slug } = await params;
  const v = pages.find((p) => p.slug === slug);
  if (!v) notFound();
  const live = v.status === 'live';
  const notify = `mailto:${site.email}?subject=${encodeURIComponent(`Tell me when ${v.name} ships`)}`;
  return (
    <>
      <Nav />
      <main id="main" className="container-x vx-teaser">
        <p className={`label flex items-center gap-2 ${live ? 'text-ember' : ''}`}>
          {live && <span aria-hidden className="live-dot size-1.5 rounded-full bg-ember" />}
          {live ? 'Live' : 'Coming soon'}
        </p>
        <WordReveal as="h1" immediate segments={[{ t: v.name }]} className="h-display vx-name" />

        <div className="vx-split">
          <div className="vx-visual vx-mark-frame" data-hot={live ? undefined : ''}>
            <MarkCast v={v} />
          </div>
          {/* The page's first screen: shown straight away rather than held for a reveal. */}
          <div className="vx-copy">
            {v.tagline && <p className="vx-tagline">{v.tagline}</p>}
            <p className="vx-desc">{v.description ?? v.blurb}</p>
            <div className="vx-actions">
              {!live && (
                <a href={notify} className="btn btn-primary">
                  Tell me when it ships
                </a>
              )}
              <Link href="/ventures" className="vf-link">
                All ventures
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
