import Link from 'next/link';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { RING, arcOutline, cells } from '@/lib/splitRing';

export const metadata = { title: 'Not found · Crucible' };

/**
 * The Split Ring at 0 K: arcs intact (with their welded end cells), the free cells drifted loose off the lattice (outward,
 * still upright, fading), the core gone dark.
 */
function ColdRing() {
  const { c, px, rings } = RING;
  const free = cells().filter((q) => !q.weld);
  return (
    <svg aria-hidden viewBox="0 0 64 64" className="cold-ring">
      {rings.map(({ r }) => (
        <path key={r} d={arcOutline(r)} fill="currentColor" />
      ))}
      {free.map(({ x, y }, k) => {
        const drift = ((Math.sin(k * 12.9898) * 43758.5453) % 1 + 1) % 1;
        // Outward from the core, 0.5 to 3.5 units, with a little sideways slip: no two cells ever meet.
        const a = Math.atan2(y - c, x - c) + (drift - 0.5) * 0.5;
        const d = 0.5 + drift * 3;
        return (
          <rect
            key={k}
            x={+(x - px / 2 + Math.cos(a) * d).toFixed(3)}
            y={+(y - px / 2 + Math.sin(a) * d).toFixed(3)}
            width={px}
            height={px}
            fill="currentColor"
            opacity={+(1 - drift * 0.6).toFixed(3)}
          />
        );
      })}
      <circle cx={c} cy={c} r={RING.core} />
    </svg>
  );
}

export default function NotFound() {
  return (
    <>
      <Nav />
      <main id="main" className="container-x flex min-h-[85svh] flex-col items-center justify-center pt-[var(--nav-h)] text-center">
        <ColdRing />
        <h1 className="h-display mt-10 max-w-3xl text-4xl sm:text-6xl">This page didn&rsquo;t survive the furnace</h1>
        <p className="mt-5 text-bone-dim">Nothing here but a ring cooled to 0 K. The page you wanted doesn&rsquo;t exist, or moved.</p>
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
