import type { StoryLift } from '@/data/home';
import type { FounderStory } from '@/data/story';
import './Story.css';

type Run = { t: string; size?: 'lead' | 'title' | 'display' };

/**
 * One founder's account, word for word (data/story.ts), set like the titles of a film over the planet. The type sits
 * on the dark sky (the world keeps the planet's limb low on phones and to the right on wide screens: journey.ts);
 * nothing is put behind it: no scrim, no box, no shadow.
 *
 * It opens with a title card: the founder's own poster (data/story.ts `poster`), then the name at display size. `intro` comes before it
 * (the section's heading), inside the same place. `interlude` is a scene rendered in the middle of the account, after
 * paragraph `after` (Jacob's: PayPal, right after the paragraph that tells it); the account then picks up where it
 * stopped under a small running name, so his display break-out lands straight after the six sparks. `lifts` are
 * sentences set larger where they stand (data/home.ts): the words are never repeated or changed.
 */
export function Chapter({
  s,
  lifts = [],
  intro,
  interlude,
  after = 1,
  place,
}: {
  s: FounderStory;
  lifts?: StoryLift[];
  intro?: React.ReactNode;
  interlude?: React.ReactNode;
  after?: number;
  place: [string, string?];
}) {
  const id = `founder-${s.name.split(' ')[0].toLowerCase()}`;
  const paras = s.paragraphs.map((text, i) => ({ text, i }));
  // Charlie's closing line is a statement: his exact words, given the room they ask for (the old site did the same).
  const statement = !interlude ? paras.pop() : undefined;
  const head = interlude ? paras.slice(0, after + 1) : paras;
  const tail = interlude ? paras.slice(after + 1) : [];
  const runs = (text: string, i: number): Run[] => {
    const marks: Run[] = lifts.filter((l) => l.paragraph === i).map((l) => ({ t: l.sentence, size: l.size }));
    if (s.breakOut?.paragraph === i) marks.push({ t: s.breakOut.sentence, size: 'display' });
    return split(text, marks);
  };

  return (
    <article aria-labelledby={id} className="wch">
      <div className="wch-part container-x" data-place={place[0]}>
        {intro}
        <header className="wch-title">
          <figure className="wch-poster" data-reveal="">
            {/* eslint-disable-next-line @next/next/no-img-element -- a static export: the two sizes are listed here */}
            <img
              src={s.poster.src}
              srcSet={`${s.poster.src.replace('-1080', '-540')} 540w, ${s.poster.src} 1080w`}
              sizes="(min-width: 900px) 26rem, calc(100vw - 2.5rem)"
              width={s.poster.w}
              height={s.poster.h}
              alt={s.poster.alt}
              loading="lazy"
              decoding="async"
              draggable={false}
            />
          </figure>
          <div className="wch-who">
            <h3 id={id} className="wch-name wide words" data-words="">
              {s.name.split(' ').map((w, k, all) => (
                <span key={w} className="wch-name-line">
                  <span className="w" style={{ '--i': k * 2 } as React.CSSProperties}>
                    {w}
                  </span>
                  {k < all.length - 1 ? ' ' : null}
                </span>
              ))}
            </h3>
            <p className="wch-role" data-reveal="">
              Co-founder
            </p>
          </div>
        </header>
        <div className="wch-text">
          {head.map(({ text, i }) => (
            <Paragraph key={i} runs={runs(text, i)} lead={i === 0} />
          ))}
        </div>
      </div>

      {interlude}

      {tail.length > 0 && (
        <div className="wch-part wch-part-cont container-x" data-place={place[1] ?? place[0]}>
          <p className="wch-running wide" aria-hidden data-reveal="">
            {s.name}
          </p>
          <div className="wch-text">
            {tail.map(({ text, i }) => (
              <Paragraph key={i} runs={runs(text, i)} />
            ))}
          </div>
        </div>
      )}

      {statement && (
        <div className="container-x" data-place={place[1] ?? place[0]}>
          <blockquote className="wch-statement">
            <p className="wide" data-reveal="">
              {statement.text}
            </p>
          </blockquote>
        </div>
      )}
    </article>
  );
}

/** The paragraph as runs, in reading order: body text and the sentences set larger. Marks that are not in the text are
 * dropped, so the text always comes out whole. */
function split(text: string, marks: Run[]): Run[] {
  const found = marks
    .map((m) => ({ m, at: text.indexOf(m.t) }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at);
  const out: Run[] = [];
  let from = 0;
  for (const { m, at } of found) {
    if (at < from) continue;
    const before = text.slice(from, at).trim();
    if (before) out.push({ t: before });
    out.push(m);
    from = at + m.t.length;
  }
  const rest = text.slice(from).trim();
  if (rest) out.push({ t: rest });
  return out;
}

const RUN_CLASS = { lead: 'wch-lead', title: 'wch-lift wide', display: 'wch-break-line wide' } as const;

/** A paragraph. A sentence with a size is set larger where it stands: the paragraph runs into it and carries on after
 * it, so it is read once, in order (the words are untouched). */
function Paragraph({ runs, lead }: { runs: Run[]; lead?: boolean }) {
  if (runs.length === 1 && !runs[0].size)
    return (
      <p className={lead ? 'wch-lead' : 'wch-p'} data-reveal="">
        {runs[0].t}
      </p>
    );
  return (
    <div className="wch-break">
      {runs.map((r) => (
        <p key={r.t} className={r.size ? RUN_CLASS[r.size] : 'wch-p'} data-reveal="">
          {r.t}
        </p>
      ))}
    </div>
  );
}
