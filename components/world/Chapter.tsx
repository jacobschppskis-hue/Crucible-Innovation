import type { FounderStory } from '@/data/story';
import { Portrait } from '@/components/Builders';
import './Story.css';

/**
 * One founder's account, word for word (data/story.ts), read while the camera glides low over the night sea. The type
 * sits on the star field (the world frames it there); nothing is put behind it: no scrim, no box, no shadow.
 *
 * `interlude` is a scene rendered in the middle of the account, after paragraph `after` (Jacob's: PayPal, right after
 * the paragraph that tells it). The account then picks up where it stopped, so his display break-out lands straight
 * after the six sparks. On wide screens the tube stays pinned beside the paragraphs before the interlude; after it, the
 * name and the reading line do.
 */
export function Chapter({ s, interlude, after = 1, place }: { s: FounderStory; interlude?: React.ReactNode; after?: number; place: [string, string?] }) {
  const id = `founder-${s.name.split(' ')[0].toLowerCase()}`;
  const paras = s.paragraphs.map((text, i) => ({ text, i }));
  // Charlie's closing line is a statement: his exact words, given the room they ask for (the old site did the same).
  const statement = !interlude ? paras.pop() : undefined;
  const head = interlude ? paras.slice(0, after + 1) : paras;
  const tail = interlude ? paras.slice(after + 1) : [];
  const breakOut = (i: number) => (s.breakOut?.paragraph === i ? s.breakOut.sentence : undefined);

  return (
    <article aria-labelledby={id} className="wch">
      <div className="wch-part container-x" data-place={place[0]}>
        <div className="wch-grid" data-scroll="read">
          <header className="wch-side">
            <div className="wch-tube">
              <Portrait name={s.name} src={s.portrait} sizes="(min-width: 1024px) 20rem, 16rem" />
            </div>
            <h3 id={id} className="wch-name wide">
              {s.name}
            </h3>
            <p className="wch-role">Co-founder</p>
            <span aria-hidden className="wch-read" />
          </header>
          <div className="wch-text">
            {head.map(({ text, i }) => (
              <Paragraph key={i} text={text} lead={i === 0} breakOut={breakOut(i)} />
            ))}
          </div>
        </div>
      </div>

      {interlude}

      {tail.length > 0 && (
        <div className="wch-part container-x" data-place={place[1] ?? place[0]}>
          <div className="wch-grid wch-grid-cont" data-scroll="read">
            <div className="wch-side" aria-hidden>
              <p className="wch-name wide">{s.name}</p>
              <span className="wch-read" />
            </div>
            <div className="wch-text">
              {tail.map(({ text, i }) => (
                <Paragraph key={i} text={text} breakOut={breakOut(i)} />
              ))}
            </div>
          </div>
        </div>
      )}

      {statement && (
        <div className="container-x" data-place={place[1] ?? place[0]}>
          <blockquote className="wch-statement">
            <p className="wide" data-reflect>
              {statement.text}
            </p>
          </blockquote>
        </div>
      )}
    </article>
  );
}

/** A paragraph. With `breakOut`, that sentence is set at display size where it stands: the paragraph runs into it and
 * carries on after it, so it is read once, in order (the words are untouched). */
function Paragraph({ text, lead, breakOut }: { text: string; lead?: boolean; breakOut?: string }) {
  const at = breakOut ? text.indexOf(breakOut) : -1;
  if (!breakOut || at < 0) return <p className={lead ? 'wch-lead' : 'wch-p'}>{text}</p>;
  const before = text.slice(0, at).trim();
  const after = text.slice(at + breakOut.length).trim();
  return (
    <div className="wch-break">
      {before && <p className="wch-p">{before}</p>}
      <p className="wch-break-line wide" data-reflect>
        {breakOut}
      </p>
      {after && <p className="wch-p">{after}</p>}
    </div>
  );
}
