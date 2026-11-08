import Link from 'next/link';
import { ventures, ventureHref, type Venture } from '@/data/ventures';
import { VenturesClient } from './VenturesClient';
import './Ventures.css';

/**
 * The ventures: three cast-metal monoliths rise out of the lava (the world draws them: lib/world/ventures.ts,
 * lib/world/glsl/monolith.glsl). Crucible Sites has cooled, with the mark cut into it and its core still orange; Verge and
 * Trellis are still hot at their feet. This component holds the words: the heading, and per venture one link that
 * holds its status, name and line, plus a transparent hit area the world lays over its monolith (`.wv-hit`), so the
 * monolith and its text are one link that works by tap. No backing behind any of it.
 *
 * Static (no JS, reduced motion, no WebGL): a plain list, each item with its arrow; the world (or its still) behind it.
 */
const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five'];
const cueFor = (v: Venture) => (v.status === 'live' ? `See ${v.name}` : `About ${v.name}`);

export function WorldVentures() {
  const all = ventures as readonly Venture[];
  const live = all.filter((v) => v.status === 'live').length;
  const next = all.length - live;
  return (
    <section id="ventures" className="wv" aria-labelledby="wv-h" data-place="ventures" data-ventures="">
      <div className="wv-pin">
        <div className="wv-stage">
          <div className="wv-head container-x">
            <h2 id="wv-h" className="h-section wv-title" data-reflect>
              Everything new was once molten
            </h2>
            <p className="wv-lede">
              {`What Crucible is building. ${WORDS[live] ?? live} ${live === 1 ? 'venture is' : 'ventures are'} live${
                next > 0 ? `; the next ${next === 1 ? 'one is' : `${(WORDS[next] ?? String(next)).toLowerCase()} are`} still in the mould` : ''
              }.`}
            </p>
          </div>
          <ul className="wv-list" role="list">
            {all.map((v, i) => (
              <li key={v.slug} className="wv-item" data-v={i} data-kind={v.status}>
                <Link className="wv-link" href={ventureHref(v)} data-v={i}>
                  {/* the monolith's own hit area: positioned by the world over the monolith's projection */}
                  <span className="wv-hit" aria-hidden />
                  <span className="wv-status">
                    <i aria-hidden />
                    {v.status === 'live' ? 'Live' : 'Coming soon'}
                  </span>
                  <span className="wv-name wide">{v.name}</span>
                  <span className="wv-line">{v.tagline ? `${v.tagline}. ${v.blurb}` : v.blurb}</span>
                  <span className="wv-go">
                    <b aria-hidden>→</b>
                    <span>{cueFor(v)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <VenturesClient />
    </section>
  );
}
