import Link from 'next/link';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { RING, arcPath, pixels } from '@/lib/splitRing';

export const metadata = { title: 'Not found · Crucible' };

/** The Split Ring at 0 K: arcs intact, pixels drifted loose, the core gone dark. */
function ColdRing() {
  const { c, px, stroke, rings } = RING;
  let k = 0;
  return (
    <svg aria-hidden viewBox="0 0 64 64" className="cold-ring">
      {rings.map(({ r, n }) => (
        <g key={r}>
          <path d={arcPath(r)} fill="none" stroke="currentColor" strokeWidth={stroke} />
          {pixels(r, n).map(({ x, y, deg }, i) => {
            const j = k++;
            const drift = ((Math.sin(j * 12.9898) * 43758.5453) % 1 + 1) % 1;
            return (
              <rect
                key={i}
                x={x - px / 2 + drift * 9}
                y={y - px / 2 + (drift - 0.5) * 7}
                width={px}
                height={px}
                fill="currentColor"
                opacity={1 - drift * 0.6}
                transform={`rotate(${deg + drift * 70} ${x} ${y})`}
              />
            );
          })}
        </g>
      ))}
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
