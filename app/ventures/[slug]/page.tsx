import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { ventures, type Venture } from '@/data/ventures';

// One page per live venture that doesn't have its own route (no `href` in data/ventures.ts).
const pages = (ventures as readonly Venture[]).filter((v) => v.status === 'live' && !v.href);

export const dynamicParams = false;
// A static export needs at least one param; with no such ventures yet, a placeholder renders the 404.
export const generateStaticParams = () => (pages.length ? pages.map(({ slug }) => ({ slug })) : [{ slug: 'none' }]);

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const v = pages.find((p) => p.slug === slug);
  return v ? { title: `${v.name} · Crucible`, description: v.blurb, alternates: { canonical: `/ventures/${v.slug}` } } : {};
}

export default async function VenturePage({ params }: Props) {
  const { slug } = await params;
  const v = pages.find((p) => p.slug === slug);
  if (!v) notFound();
  return (
    <>
      <Nav />
      <main id="main" className="container-x min-h-[80svh] pt-[calc(var(--nav-h)+6rem)] pb-24">
        <p className="label text-ember">Live venture</p>
        <h1 className="h-display mt-5 text-5xl sm:text-7xl">{v.name}</h1>
        <p className="mt-6 max-w-2xl text-xl leading-relaxed text-bone-dim">{v.description ?? v.blurb}</p>
        <Link href="/#ventures" className="btn btn-ghost mt-10">
          All ventures
        </Link>
      </main>
      <Footer />
    </>
  );
}
