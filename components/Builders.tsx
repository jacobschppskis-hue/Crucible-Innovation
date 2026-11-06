import Image from 'next/image';
import { builders, type Builder } from '@/data/team';
import { ArrowRight } from './Icons';
import { Reveal } from './Reveal';
import { SplitRing } from './SplitRing';

/** A builder's ASCII portrait: bone characters on transparent, straight on the page (no card), or the Split Ring when there is none. Also used by the home page Story. */
export function Portrait({ name, src, sizes = '(min-width: 768px) 24rem, 90vw' }: { name: string; src?: string; sizes?: string }) {
  if (src) {
    return (
      <div data-float="block" className="relative aspect-[5/6]">
        <Image src={src} alt={`ASCII portrait of ${name}`} width={800} height={956} sizes={sizes} className="absolute inset-0 h-full w-full object-contain" />
      </div>
    );
  }
  return (
    <div className="relative aspect-[5/6] overflow-hidden rounded-2xl border border-line bg-ground-2 shadow-[inset_-1px_0_0_rgba(255,91,31,0.35)]">
      <div className="absolute inset-0 grid place-items-center">
        <SplitRing size="38%" title="" />
      </div>
      {/* faint ember rim light */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_70%_at_105%_40%,rgba(255,91,31,0.16),transparent_60%)] mix-blend-screen" />
    </div>
  );
}

function Bio({ b }: { b: Builder }) {
  return (
    <>
      <div className="mt-6 max-w-xl space-y-4 text-lg leading-relaxed text-bone-dim">
        {b.bio.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
      {b.signoff && <p className="wide mt-6 font-display text-xl font-semibold text-bone">{b.signoff}</p>}
    </>
  );
}

/** "Who you'll work with": one person reads as a personal intro, two or more as "Meet the builders." */
export function Builders() {
  const solo = builders.length === 1;

  if (solo) {
    const [b] = builders;
    return (
      <section aria-labelledby="who" className="cv-auto container-x pb-24 sm:pb-32" style={{ '--h-sm': '2100px', '--h-lg': '1200px' } as React.CSSProperties}>
        <div className="grid items-center gap-10 md:grid-cols-[0.8fr_1fr] md:gap-16">
          <Reveal className="mx-auto w-full max-w-sm md:max-w-none">
            <Portrait name={b.name} src={b.portrait} />
          </Reveal>
          <div>
            <h2 id="who" className="h-section">
              Hi, I&rsquo;m {b.name}
            </h2>
            <Reveal>
              <Bio b={b} />
              <a href="#start" className="btn btn-ghost mt-8">
                Talk to me directly <ArrowRight />
              </a>
            </Reveal>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="who" className="cv-auto container-x pb-24 sm:pb-32" style={{ '--h-sm': '2100px', '--h-lg': '1200px' } as React.CSSProperties}>
      <h2 id="who" className="h-section">
        Meet the builders
      </h2>
      <p className="mt-6 max-w-md text-lg leading-relaxed text-bone-dim">You talk to the people building your site, from the first call to launch day.</p>
      <ul className="mt-12 grid gap-12 md:grid-cols-2 md:gap-10">
        {builders.map((b, i) => (
          <Reveal as="li" key={b.name} delay={i * 0.1}>
            <div className="max-w-sm">
              <Portrait name={b.name} src={b.portrait} />
            </div>
            <h3 className="wide mt-8 font-display text-2xl font-semibold tracking-[-0.015em]">{b.name}</h3>
            <p className="mt-2 text-bone-dim">{b.role}</p>
            {b.email && (
              <a href={`mailto:${b.email}`} className="mt-1 inline-block text-sm text-bone-dim underline-offset-4 hover:text-ember hover:underline">
                {b.email}
              </a>
            )}
            <Bio b={b} />
          </Reveal>
        ))}
      </ul>
      <a href="#start" className="btn btn-ghost mt-12">
        Talk to us directly <ArrowRight />
      </a>
    </section>
  );
}
