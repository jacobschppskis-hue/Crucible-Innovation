import { pullQuote, story } from '@/data/story';
import { site } from '@/data/site';
import { Reveal } from './Reveal';
import { WordReveal } from './WordReveal';

/** "Why Crucible": Jacob's story, set as a long-form essay with one pulled quote. */
export function Story() {
  const [intro, ...rest] = story;
  return (
    <section id="story" className="container-x py-24 sm:py-32">
      <div className="mx-auto max-w-2xl">
        <p className="label">Why Crucible</p>
        <WordReveal as="h2" segments={[{ t: 'Where it' }, { t: 'started.', className: 'accent' }]} className="h-section mt-4" />
        <Reveal>
          <p className="mt-10 text-xl leading-relaxed text-bone sm:text-2xl">{intro}</p>
        </Reveal>
        {rest.map((p, i) => (
          <div key={i}>
            <Reveal>
              <p className="mt-7 text-lg leading-[1.75] text-bone-dim">{p}</p>
            </Reveal>
            {i === 0 && (
              <Reveal>
                <blockquote className="my-14 border-l border-line-strong pl-6 font-serif text-3xl italic leading-snug text-bone sm:-mx-16 sm:pl-10 sm:text-4xl">
                  {pullQuote}
                </blockquote>
              </Reveal>
            )}
          </div>
        ))}
        <Reveal>
          <p className="mt-12 font-serif text-2xl italic text-bone">{site.founder.name}</p>
          <p className="label mt-2">Founder, Crucible</p>
        </Reveal>
      </div>
    </section>
  );
}
