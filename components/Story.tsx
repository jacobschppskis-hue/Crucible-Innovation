import { stories, type FounderStory } from '@/data/story';
import { Portrait } from './Builders';
import { HeatText } from './HeatText';
import { WordReveal } from './WordReveal';
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

// What came out of PayPal, per Jacob's account, as one casting: metal poured into "PayPal" runs down one sprue and out
// through six gates into moulds shaped like the six names, in the order he tells them. The drawing is in em of the names'
// size (SVG units: 100 = 1em), so the tree scales as one. `inset` (em) moves a name towards the sprue until its gate meets
// ink at mid-height (measured from Archivo: the X and the T are open there).
const CAST: { name: string; inset: number }[][] = [
  [{ name: 'YouTube', inset: 0.065 }, { name: 'LinkedIn', inset: 0.105 }],
  [{ name: 'Yelp', inset: 0.07 }, { name: 'Palantir', inset: 0.105 }],
  [{ name: 'SpaceX', inset: 0.28 }, { name: 'Tesla', inset: 0.305 }],
];
const W = 190; // sprue and both gates; the names start at either edge
const CX = W / 2;
const TOP = 122; // the sprue leaves PayPal's baseline...
const END = 685; // ...and ends in a rounded sump below the last gates
const WIDE = 13; // sprue half-width at the top, tapering to NARROW
const NARROW = 7;
const ROOT = 4.5; // gate half-thickness at the sprue, narrowing to NECK where it meets the name (where a part snaps off)
const NECK = 2;
const rowY = (k: number) => 280 + k * 180; // each pair's gates, at the names' mid-cap height
const half = (y: number) => WIDE + ((NARROW - WIDE) * (y - TOP)) / (END - NARROW - TOP);
const n = (v: number) => +v.toFixed(1);
const vars = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [`--${k}`, +v.toFixed(3)])) as React.CSSProperties;

// The pour on one timeline t (0..1; a/d = fill start/length, c/cd = cooling start/length): PayPal fills, the sprue
// runs down, each pair fills as the metal passes its gates. Each piece cools and sets after it has filled, so the first
// names are bone while the last still glow, and PayPal, the feeder, sets last.
const SPRUE = { a: 0.16, d: 0.4, c: 0.56, cd: 0.36 };
const HEAD = { a: 0.04, d: 0.14, c: 0.62, cd: 0.36 };
const GATE_D = 0.035;
const NAME_D = 0.09;
const COOL = 0.26;

const sprueShape = `M${CX - WIDE} ${TOP}L${CX - NARROW} ${END - NARROW}A${NARROW} ${NARROW} 0 0 0 ${CX + NARROW} ${END - NARROW}L${CX + WIDE} ${TOP}Z`;

/** The empty mould: both walls of the sprue, broken where the gates leave, and the walls of each gate. */
function mould() {
  let d = '';
  for (const s of [-1, 1]) {
    const edge = s < 0 ? 0 : W;
    let y = TOP;
    for (let k = 0; k < CAST.length; k++) {
      const yk = rowY(k);
      d += `M${n(CX + s * half(y))} ${n(y)}L${n(CX + s * half(yk - ROOT))} ${n(yk - ROOT)}L${edge} ${yk - NECK}`;
      d += `M${edge} ${yk + NECK}L${n(CX + s * half(yk + ROOT))} ${n(yk + ROOT)}`;
      y = yk + ROOT;
    }
    d += `L${CX + s * NARROW} ${END - NARROW}`;
  }
  return d + `M${CX - NARROW} ${END - NARROW}A${NARROW} ${NARROW} 0 0 0 ${CX + NARROW} ${END - NARROW}`;
}

/** A name in metal: the mould outline (::before), the liquid (real text), its white-hot front, and the set metal. */
function Casting({ name, className, style }: { name: string; className: string; style: React.CSSProperties }) {
  return (
    <span className={`sp-w sp-m ${className}`} data-w={name} style={style}>
      <span>{name}</span>
      <span>{name}</span>
      <span>{name}</span>
    </span>
  );
}

/** One run of metal along a path: liquid, its white-hot front, and the set metal coming back from the far end. */
function Run({ d, back, width, style, front }: { d: string; back: string; width: number; style: React.CSSProperties; front?: boolean }) {
  return (
    <>
      <path className="sp-m" pathLength={1} strokeWidth={width} style={style} d={d} />
      {front && <path className="sp-m sp-fr" pathLength={1} strokeWidth={width} style={style} d={d} />}
      <path className="sp-m sp-set" pathLength={1} strokeWidth={width} style={style} d={back} />
    </>
  );
}

function SplitBeat() {
  const sprue = vars(SPRUE);
  const gates = CAST.flatMap((pair, k) =>
    pair.map(({ name, inset }, side) => {
      const y = rowY(k);
      const edge = side ? W : 0;
      const a = SPRUE.a + (SPRUE.d * (y - TOP)) / (END - TOP); // when the metal in the sprue reaches this gate
      const filled = a + GATE_D + NAME_D;
      return {
        name,
        side,
        out: `M${CX} ${y}H${edge}`,
        back: `M${edge} ${y}H${CX}`,
        shape: `M${CX} ${y - ROOT}L${edge} ${y - NECK}V${y + NECK}L${CX} ${y + ROOT}Z`,
        gate: vars({ a, d: GATE_D, c: filled + 0.03, cd: COOL }),
        word: vars({ a: a + GATE_D, d: NAME_D, c: filled, cd: COOL, y: y / 100, in: inset }),
      };
    }),
  );
  return (
    <figure
      data-scroll="view"
      data-float="block"
      className="beat beat-split"
      aria-label="One company, PayPal, and six that came out of it: YouTube, LinkedIn, Yelp, Palantir, SpaceX and Tesla."
    >
      <div aria-hidden className="sp">
        <span className="sp-stream" />
        <svg className="sp-net" viewBox={`0 0 ${W} 740`}>
          <defs>
            <clipPath id="sp-tree">
              <path d={sprueShape} />
              {gates.map((g) => (
                <path key={g.name} d={g.shape} />
              ))}
            </clipPath>
            <filter id="sp-glow" x="-1" y="-0.2" width="3" height="1.4">
              <feGaussianBlur stdDeviation="9" />
            </filter>
          </defs>
          <path className="sp-wall" vectorEffect="non-scaling-stroke" d={mould()} />
          <g filter="url(#sp-glow)">
            <path className="sp-m sp-halo" pathLength={1} strokeWidth={40} style={sprue} d={`M${CX} ${TOP}V${END}`} />
            {gates.map((g) => (
              <path key={g.name} className="sp-m sp-halo" pathLength={1} strokeWidth={20} style={g.gate} d={g.out} />
            ))}
          </g>
          {/* gates first: the sprue's own metal covers their roots */}
          <g clipPath="url(#sp-tree)">
            {gates.map((g) => (
              <Run key={g.name} d={g.out} back={g.back} width={ROOT * 2} style={g.gate} />
            ))}
            <Run d={`M${CX} ${TOP}V${END}`} back={`M${CX} ${END}V${TOP}`} width={WIDE * 2} style={sprue} front />
          </g>
        </svg>
        <Casting name="PayPal" className="sp-head" style={vars(HEAD)} />
        {gates.map((g) => (
          <Casting key={g.name} name={g.name} className={g.side ? 'sp-r' : 'sp-l'} style={g.word} />
        ))}
      </div>
    </figure>
  );
}
