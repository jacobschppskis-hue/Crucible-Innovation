import Image from 'next/image';
import { builders, type Builder } from '@/data/team';
import { ArrowRight } from './Icons';
import { Reveal } from './Reveal';
import { SplitRing } from './SplitRing';

function Portrait({ b, sizes }: { b: Builder; sizes: string }) {
  return (
    <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-line bg-ground-2 shadow-[inset_-1px_0_0_rgba(255,91,31,0.35)]">
      {b.photo ? (
        <Image src={b.photo} alt={`Portrait of ${b.name}`} fill sizes={sizes} className="object-cover grayscale contrast-110" />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <SplitRing size="38%" title="" />
        </div>
      )}
      {/* faint ember rim light */}
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(90%_70%_at_105%_40%,rgba(255,91,31,0.18),transparent_60%)] mix-blend-screen" />
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
      {b.signoff && <p className="mt-6 font-serif text-2xl italic text-bone">{b.signoff}</p>}
    </>
  );
}

/** "Who you'll work with": one person reads as a personal intro, two or more as "Meet the builders." */
export function Builders() {
  const solo = builders.length === 1;

  if (solo) {
    const [b] = builders;
    return (
      <section aria-labelledby="who" className="container-x pb-24 sm:pb-32">
        <div className="grid items-center gap-10 md:grid-cols-[0.8fr_1fr] md:gap-16">
          <Reveal className="mx-auto w-full max-w-sm md:max-w-none">
            <Portrait b={b} sizes="(min-width: 768px) 40vw, 90vw" />
          </Reveal>
          <div>
            <p className="label">Who you&rsquo;ll work with</p>
            <h2 id="who" className="h-section mt-4">
              Hi, I&rsquo;m {b.name}.
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
    <section aria-labelledby="who" className="container-x pb-24 sm:pb-32">
      <p className="label">Who you&rsquo;ll work with</p>
      <h2 id="who" className="h-section mt-4">
        Meet the <span className="accent">builders.</span>
      </h2>
      <ul className="mt-12 grid gap-12 md:grid-cols-2 md:gap-10">
        {builders.map((b, i) => (
          <Reveal as="li" key={b.name} delay={i * 0.1}>
            <div className="max-w-xs">
              <Portrait b={b} sizes="(min-width: 768px) 20rem, 80vw" />
            </div>
            <h3 className="mt-8 font-display text-2xl font-semibold tracking-[-0.02em]">{b.name}</h3>
            <p className="label mt-2">{b.role}</p>
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
