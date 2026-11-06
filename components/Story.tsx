import { stories, type FounderStory } from '@/data/story';
import { Portrait } from './Builders';
import { HeatText } from './HeatText';
import { WordReveal } from './WordReveal';

/**
 * "Why Crucible": the co-founders in their own words, one chapter each (Jacob first). On wide screens the portrait
 * stays pinned beside the text while it is read; the text warms from dim to bone as it goes. Between Jacob's
 * paragraphs, one moment from his own account is shown rather than told: one company splitting into six. The words are theirs and are never edited (data/story.ts).
 */
export function Story() {
  return (
    <section id="story" aria-labelledby="story-h" className="story relative py-28 sm:py-40">
      <div className="container-x">
        <WordReveal as="h2" id="story-h" segments={[{ t: 'Why Crucible' }]} className="h-section" />
        <p className="mt-6 max-w-md text-lg leading-relaxed text-bone-dim">
          Jacob Schopp and Charles Rochford, co-founders, each in their own words.
        </p>
      </div>
      {stories.map((s, i) => (
        <Chapter key={s.name} s={s} first={i === 0} />
      ))}
    </section>
  );
}

function Chapter({ s, first }: { s: FounderStory; first: boolean }) {
  const id = `founder-${s.name.split(' ')[0].toLowerCase()}`;
  const [lead, ...rest] = s.paragraphs;
  // Charlie's closing line is set as a statement: still his exact words, just given the room they ask for.
  const statement = !first ? rest.pop() : undefined;
  return (
    <article aria-labelledby={id} className="story-chapter container-x mt-24 grid gap-10 sm:mt-36 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-20">
      <header className="story-side">
        <div className="w-full max-w-[18rem] lg:max-w-none" data-pull="10">
          <Portrait name={s.name} src={s.portrait} sizes="(min-width: 1024px) 22rem, 18rem" />
        </div>
        <h3 id={id} className="wide mt-6 font-display text-3xl font-semibold leading-none tracking-[-0.015em]">
          {s.name}
        </h3>
        <p className="mt-2 text-bone-dim">Co-founder</p>
      </header>

      <div className="story-text max-w-[40rem]">
        <HeatText text={lead} className="text-[1.375rem] leading-[1.5] sm:text-2xl" />
        {rest.map((p, i) => (
          <div key={i}>
            <HeatText text={p} className="heat-body mt-8 text-lg leading-[1.7]" />
            {first && i === 0 && <SplitBeat />}
            {first && i === 1 && s.pullQuote && (
              <blockquote className="story-quote">
                <p className="wide font-display font-semibold">{s.pullQuote}</p>
              </blockquote>
            )}
          </div>
        ))}
        {statement && (
          <blockquote className="story-quote">
            <p className="wide font-display font-semibold">{statement}</p>
          </blockquote>
        )}
      </div>
    </article>
  );
}

// What came out of PayPal, per Jacob's account: one bar of metal that splits into six as it scrolls past.
const OFFSHOOTS = ['YouTube', 'LinkedIn', 'Yelp', 'Palantir', 'SpaceX', 'Tesla'];

function SplitBeat() {
  return (
    <figure data-scroll="view" className="beat beat-split" aria-label="One company, PayPal, and six that came out of it: YouTube, LinkedIn, Yelp, Palantir, SpaceX and Tesla.">
      <div aria-hidden className="split">
        <span className="split-name">PayPal</span>
        {OFFSHOOTS.map((name, i) => (
          <span key={name} className="split-piece" style={{ '--i': i, '--c': i % 3, '--r': Math.floor(i / 3) } as React.CSSProperties}>
            <span className="split-label">{name}</span>
          </span>
        ))}
      </div>
    </figure>
  );
}
