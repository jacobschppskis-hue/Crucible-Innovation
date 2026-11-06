import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import { ventures, ventureHref, type Venture } from '@/data/ventures';
import { ArrowRight } from './Icons';
import { IngotScene } from './IngotScene';
import { SplitRing } from './SplitRing';
import { WordReveal } from './WordReveal';
import './Ventures.css';

// Ingot stills (scripts/ingot-stills.mjs → public/film/ingots/<slug>-<w>.webp, transparent). Checked at build time, so a venture without a
// render falls back to its mark drawn in CSS: cool for a live venture, still glowing for one in the mould.
export const hasIngot = (slug?: string) => !!slug && fs.existsSync(path.join(process.cwd(), 'public/film/ingots', `${slug}-1200.webp`));

/**
 * The foundry floor. Each venture is a cast object: Crucible Sites has set and cooled; the next ones are still glowing
 * in their moulds. On wide screens the floor is a pinned horizontal track that scrolls sideways; on phones, with
 * reduced motion and without JS it's a plain vertical list.
 */
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five'];

export function Ventures() {
  const all = ventures as readonly Venture[];
  const live = all.filter((v) => v.status === 'live').length;
  const next = all.length - live;
  return (
    <section id="ventures" aria-labelledby="ventures-h" data-scroll="pin" data-heat="" className="vf relative">
      <div className="vf-sticky">
        <div className="vf-track">
          <div className="vf-intro">
            <WordReveal as="h2" id="ventures-h" segments={[{ t: 'Everything new was once molten' }]} className="h-section max-w-[11ch]" />
            <p className="mt-6 max-w-sm text-lg leading-relaxed text-bone-dim">
              {`What Crucible is building. ${cap(WORDS[live] ?? String(live))} ${live === 1 ? 'venture is' : 'ventures are'} live${
                next > 0 ? `; the next ${next === 1 ? 'one is' : `${WORDS[next] ?? next} are`} still in the mould` : ''
              }.`}
            </p>
          </div>
          {(ventures as readonly Venture[]).map((v) => (
            <VentureCast key={v.slug} v={v} />
          ))}
        </div>
      </div>
    </section>
  );
}

const cap = (w: string) => w[0].toUpperCase() + w.slice(1);

function VentureCast({ v }: { v: Venture }) {
  const live = v.status === 'live';
  const href = ventureHref(v);
  return (
    <article className="vf-panel group" data-hot={live ? undefined : ''} aria-labelledby={`v-${v.slug}`}>
      <Link href={href} tabIndex={-1} aria-hidden className="vf-visual" data-pull="14">
        <VentureObject v={v} />
      </Link>
      <div className="vf-text">
        <p className={`label flex items-center gap-2 ${live ? 'text-ember' : ''}`}>
          {live && <span aria-hidden className="live-dot size-1.5 rounded-full bg-ember" />}
          {live ? 'Live' : 'Coming soon'}
        </p>
        <h3 id={`v-${v.slug}`} className="vf-name">
          {v.name}
        </h3>
        <p className="mt-4 max-w-sm text-lg leading-relaxed text-bone-dim">{v.tagline ? `${v.tagline}. ${v.blurb}` : v.blurb}</p>
        <Link href={href} className="vf-link mt-8">
          {live ? `See ${v.name}` : `About ${v.name}`} <ArrowRight />
        </Link>
      </div>
    </article>
  );
}

/**
 * A venture's cast object, decorative: its freestanding 3D ingot (a transparent still until the scene starts) when one exists, else its mark. The caller sets
 * the temperature (`data-hot` on an ancestor while the venture is still forging) and the frame's size. Also used by
 * the /ventures pages.
 */
export function VentureObject({ v, sizes = '(min-width: 1024px) 44vw, 92vw', eager }: { v: Venture; sizes?: string; eager?: boolean }) {
  return hasIngot(v.ingot) ? <IngotScene slug={v.ingot!} sizes={sizes} eager={eager} /> : <MarkCast v={v} />;
}

/** The fallback visual: the venture's mark in its mould. */
export function MarkCast({ v }: { v: Venture }) {
  return (
    <span className="vf-mould">
      {v.slug === 'sites' && <SplitRing size="42%" title="" />}
      {v.slug === 'trellis' && (
        <svg viewBox="192 192 640 640" className="vf-mark" aria-hidden>
          {[296, 480, 664].map((y) => (
            <rect key={y} x="192" y={y} width="640" height="64" />
          ))}
          {[336, 624].map((x) => (
            <rect key={x} x={x} y="192" width="64" height="640" />
          ))}
        </svg>
      )}
      {v.slug === 'verge' && (
        <svg viewBox="0 0 512 512" className="vf-mark" aria-hidden>
          <text x="256" y="400" fontFamily="Georgia, 'Times New Roman', serif" fontSize="460" fontWeight="600" textAnchor="middle" fill="currentColor">
            V
          </text>
        </svg>
      )}
    </span>
  );
}
