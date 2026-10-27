import type { Metadata } from 'next';
import { Footer } from '@/components/Footer';
import { Ignition } from '@/components/Ignition';
import { JsonLd } from '@/components/JsonLd';
import { Nav } from '@/components/Nav';
import { Story } from '@/components/Story';
import { Thesis } from '@/components/Thesis';
import { Ventures } from '@/components/Ventures';

export const metadata: Metadata = {
  title: 'Crucible: Intelligence, alloyed.',
  description: 'Crucible is a studio that builds and ships ventures. Human judgment and machine range, fused into one material.',
  alternates: { canonical: '/' },
  openGraph: { title: 'Crucible', description: 'Intelligence, alloyed. A studio that builds and ships ventures.', url: '/' },
};

export default function Home() {
  return (
    <>
      <Nav variant="home" />
      <main id="main">
        {/* The opening: ignition on load, then the ring comes apart and fuses as you scroll */}
        <Ignition />

        {/* Jacob's story: why Crucible exists and where the name comes from */}
        <Story />

        {/* Ventures: the live one casts a concept site as it scrolls in; the rest are still in the furnace */}
        <Ventures />

        <Thesis />
      </main>
      <Footer />
      <JsonLd page="home" />
    </>
  );
}
