import { stories, type FounderStory } from '@/data/story';
import { Portrait } from './Builders';
import { HeatText } from './HeatText';
import { WordReveal } from './WordReveal';
import { SplitPourGL, SplitTree } from './SplitPour';
import { PAYPAL, nameTimes } from '@/lib/gl/splitTime';
import './Story.css';

/**
 * "Why Crucible": the co-founders in their own words, one chapter each (Jacob first). On wide screens the portrait
 * stays pinned beside the text while it is read; the text warms from dim to bone as it goes. Between Jacob's
 * paragraphs, one moment from his own account is shown rather than told: one pour into PayPal casts six companies.
 * The words are theirs and are never edited (data/story.ts).
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
            <Paragraph text={p} breakOut={s.breakOut?.paragraph === i + 1 ? s.breakOut.sentence : undefined} />
            {first && i === 0 && <SplitBeat />}
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

/** A body paragraph. With `breakOut`, that sentence is set at display size where it stands: the paragraph runs into
 * it and carries on after it, so it is read once, in order (the words are untouched). */
function Paragraph({ text, breakOut }: { text: string; breakOut?: string }) {
  const at = breakOut ? text.indexOf(breakOut) : -1;
  if (!breakOut || at < 0) return <HeatText text={text} className="heat-body mt-8 text-lg leading-[1.7]" />;
  const before = text.slice(0, at).trim();
  const after = text.slice(at + breakOut.length).trim();
  return (
    <div className="story-break">
      {before && <HeatText text={before} className="heat-body mt-8 text-lg leading-[1.7]" />}
      <HeatText text={breakOut} className="story-break-line wide font-display font-semibold" />
      {after && <HeatText text={after} className="heat-body text-lg leading-[1.7]" />}
    </div>
  );
}

// What came out of PayPal, per Jacob's account, in his order, row by row: the metal leaves PayPal through the y and runs
// into the six names. Sizes are in em of the names' size, so the figure scales as one. `in` (em): how far into the
// name the run enters, at mid x-height, so it meets ink (the X and the T are open at the side; read by lib/gl/splitPour).
const ROWS: { name: string; in: number }[][] = [
  [{ name: 'YouTube', in: 0.05 }, { name: 'LinkedIn', in: 0.06 }],
  [{ name: 'Yelp', in: 0.06 }, { name: 'Palantir', in: 0.06 }],
  [{ name: 'SpaceX', in: 0.27 }, { name: 'Tesla', in: 0.29 }],
];
const vars = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [`--${k}`, +v.toFixed(3)])) as React.CSSProperties;

/** A name in metal, as real text: the empty cavity (the name itself, faint), the liquid, its white-hot front, the set metal. */
function Casting({ name, className, style, inset }: { name: string; className: string; style: React.CSSProperties; inset?: number }) {
  return (
    <span className={`sp-w ${className}`} style={style} data-in={inset}>
      {name}
      <span className="sp-liq">{name}</span>
      <span className="sp-fr">{name}</span>
      <span className="sp-set">{name}</span>
    </span>
  );
}

function SplitBeat() {
  return (
    <figure
      data-scroll="view"
      data-float="block"
      className="beat beat-split"
      aria-label="One company, PayPal, and six that came out of it: YouTube, LinkedIn, Yelp, Palantir, SpaceX and Tesla."
    >
      <div aria-hidden className="sp">
        <SplitTree />
        <SplitPourGL />
        <Casting name="PayPal" className="sp-head" style={vars(PAYPAL)} />
        {ROWS.map((pair, k) =>
          pair.map((n, side) => (
            <Casting key={n.name} name={n.name} className={side ? 'sp-r' : 'sp-l'} inset={n.in} style={vars({ ...nameTimes(k), row: k })} />
          )),
        )}
      </div>
    </figure>
  );
}
