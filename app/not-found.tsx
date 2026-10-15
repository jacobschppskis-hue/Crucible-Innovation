import Link from 'next/link';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { SplitRing } from '@/components/SplitRing';

export const metadata = { title: 'Not found · Crucible' };

export default function NotFound() {
  return (
    <>
      <Nav />
      <main id="main" className="container-x flex min-h-[85svh] flex-col items-center justify-center pt-[var(--nav-h)] text-center">
        <SplitRing size={72} title="" className="opacity-60" />
        <p className="label mt-10">Error 404 · Cooled to 0 K</p>
        <h1 className="h-display mt-5 max-w-2xl text-4xl sm:text-6xl">
          This page didn&rsquo;t survive <span className="accent">the furnace.</span>
        </h1>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn btn-ghost">
            Back to Crucible
          </Link>
          <Link href="/sites" className="btn btn-primary">
            See Crucible Sites
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
