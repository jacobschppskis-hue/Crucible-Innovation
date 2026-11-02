import { stories, type FounderStory } from '@/data/story';
import { Portrait } from './Builders';
import { HeatText } from './HeatText';
import { Reveal } from './Reveal';
import { WordReveal } from './WordReveal';

/**
 * "Why Crucible": both co-founders in their own words, side by side on wide screens and one after the other on
 * phones. Each column warms up as it is read.
 */
export function Story() {
  return (
    <section id="story" className="container-x py-24 sm:py-32">
      <div className="mx-auto max-w-2xl lg:mx-0">
        <p className="label">Why Crucible</p>
        <WordReveal as="h2" segments={[{ t: 'Meet the' }, { t: 'founders.', className: 'accent' }]} className="h-section mt-4" />
      </div>
      <div className="mt-14 grid gap-24 lg:grid-cols-2 lg:gap-16 xl:gap-24">
        {stories.map((s, i) => (
          <Founder key={s.name} s={s} delay={i * 0.1} />
        ))}
      </div>
    </section>
  );
}

function Founder({ s, delay }: { s: FounderStory; delay: number }) {
  const [intro, ...rest] = s.paragraphs;
  const id = `founder-${s.name.split(' ')[0].toLowerCase()}`;
  return (
    <article aria-labelledby={id} className="mx-auto w-full max-w-2xl lg:mx-0">
      <Reveal delay={delay}>
        {/* Same size as on /sites: much smaller and the ASCII grid shimmers (moiré) on 1x screens. */}
        <div className="w-full max-w-sm">
          <Portrait name={s.name} src={s.portrait} sizes="(min-width: 768px) 24rem, 90vw" />
        </div>
        <h3 id={id} className="mt-8 font-display text-2xl font-semibold tracking-[-0.02em]">
          {s.name}
        </h3>
        <p className="label mt-2">{s.role}</p>
      </Reveal>
      <Reveal>
        <HeatText text={intro} className="mt-8 text-xl leading-relaxed" />
      </Reveal>
      {rest.map((p, i) => (
        <div key={i}>
          <Reveal>
            <HeatText text={p} className="heat-body mt-7 text-lg leading-[1.75]" />
          </Reveal>
          {i === 0 && s.pullQuote && (
            <Reveal>
              <HeatText
                as="blockquote"
                text={s.pullQuote}
                className="my-14 border-l border-line-strong pl-6 font-serif text-3xl italic leading-snug sm:-mx-16 sm:pl-10 sm:text-4xl lg:mx-0 lg:pl-8"
              />
            </Reveal>
          )}
        </div>
      ))}
    </article>
  );
}
