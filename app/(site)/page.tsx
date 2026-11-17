import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import { Nav } from '@/components/Nav';
import { Hero, LoopClone } from '@/components/world/Hero';
import { Footer } from '@/components/world/Footer';
import { PayPal } from '@/components/world/PayPal';
import { Story } from '@/components/world/Story';
import { Thesis } from '@/components/world/Thesis';
import { Together } from '@/components/world/Together';
import { WorldVentures } from '@/components/world/Ventures';
import { WorldMount } from '@/components/world/WorldMount';
import '@/components/world/World.css';

export const metadata: Metadata = {
  title: 'Crucible: Intelligence, alloyed.',
  description: 'Crucible is a studio that builds and ships ventures. Human judgment and machine range, fused into one material.',
  alternates: { canonical: '/' },
  openGraph: { title: 'Crucible', description: 'Intelligence, alloyed. A studio that builds and ships ventures.', url: '/' },
};

/**
 * The home page: one world around a molten planet (lib/world, ARCHITECTURE.md). Every section is a place on the
 * journey (`data-place`), all of its content static, readable HTML; the world paints behind it. The last place is the
 * hero's first screen again, so the page loops (lib/world/loop.ts). Order = the journey's order (lib/world/journey.ts).
 */
export default function Home() {
  return (
    <div data-world-root className="w-root">
      <Nav variant="home" />
      <main id="main">
        <Hero />
        <Together />
        <Story paypal={<PayPal />} />
        <WorldVentures />
        <Thesis />
      </main>
      <Footer />
      <LoopClone />
      <WorldMount />
      <JsonLd page="home" />
    </div>
  );
}
