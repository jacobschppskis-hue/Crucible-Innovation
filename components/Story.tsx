import { pullQuote, story } from '@/data/story';
import { site } from '@/data/site';
import { HeatText } from './HeatText';
import { Reveal } from './Reveal';
import { WordReveal } from './WordReveal';

/** "Why Crucible": Jacob's story, set as a long-form essay with one pulled quote. It warms up as it is read. */
export function Story() {
  const [intro, ...rest] = story;
  return (
    <section id="story" className="container-x py-24 sm:py-32">
      <div className="mx-auto max-w-2xl">
        <p className="label">Why Crucible</p>
        <WordReveal as="h2" segments={[{ t: 'Where it' }, { t: 'started.', className: 'accent' }]} className="h-section mt-4" />
        <Reveal>
          <HeatText text={intro} className="mt-10 text-xl leading-relaxed sm:text-2xl" />
        </Reveal>
        {rest.map((p, i) => (
          <div key={i}>
            <Reveal>
              <HeatText text={p} className="heat-body mt-7 text-lg leading-[1.75]" />
            </Reveal>
            {i === 0 && (
              <Reveal>
                <HeatText
                  as="blockquote"
                  text={pullQuote}
                  className="my-14 border-l border-line-strong pl-6 font-serif text-3xl italic leading-snug sm:-mx-16 sm:pl-10 sm:text-4xl"
                />
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
