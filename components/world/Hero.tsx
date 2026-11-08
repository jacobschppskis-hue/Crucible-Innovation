import Link from 'next/link';
import { hero } from '@/data/home';
import { ArrowRight } from '@/components/Icons';

/**
 * The hero's first screen: the headline over the sunset (the world paints the sea, the sun and the mark behind it).
 * `clone` renders the identical screen at the very end of the page (the loop place): inert and hidden from assistive
 * tech, with the same classes so the seam is invisible. Owned by `world` (layout of the screen); copy in data/home.ts.
 */
export function HeroScreen({ clone = false }: { clone?: boolean }) {
  const H = clone ? 'div' : 'h1';
  return (
    <div className="w-hero-screen">
      <div className="w-hero-copy container-x">
        <H className="w-hero-title h-display">
          <span className="w-hero-line">{hero.lines[0]}</span>{' '}
          <span className="w-hero-line">
            <span className="ig-cool" data-text={hero.lines[1]}>
              {hero.lines[1]}
            </span>
          </span>
        </H>
        <div className="w-hero-meta">
          <p className="text-base leading-relaxed text-bone-dim sm:text-lg">{hero.lede}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={hero.primary.href} className="btn btn-primary" tabIndex={clone ? -1 : undefined}>
              {hero.primary.label} <ArrowRight />
            </Link>
            <a href={hero.secondary.href} className="btn btn-ghost" tabIndex={clone ? -1 : undefined}>
              {hero.secondary.label}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section id="top" data-place="hero" aria-label="Crucible" className="w-place w-hero">
      <div className="w-sticky">
        <HeroScreen />
      </div>
    </section>
  );
}

/** The loop: the hero's first screen again, one viewport tall, last on the page. Shown only while the page loops. */
export function LoopClone() {
  return (
    <section data-place="loop" aria-hidden="true" inert className="w-place w-loop">
      <HeroScreen clone />
    </section>
  );
}
