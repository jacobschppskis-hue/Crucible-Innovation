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
export const hasMonolith = (name?: string) => !!name && fs.existsSync(path.join(process.cwd(), 'public/film/monoliths', `${name}-1200.webp`));
export const hasIngot = (slug?: string) => !!slug && fs.existsSync(path.join(process.cwd(), 'public/film/ingots', `${slug}-1200.webp`));

/**
 * The foundry floor. Each venture is a cast bar: Crucible Sites has set and cooled; the next ones are still glowing. On wide screens the floor is a pinned horizontal track that scrolls sideways; on phones, with
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
/** What opening a venture says: on its link and on the label its bar shows. */
export const cueFor = (v: Venture) => (v.status === 'live' ? `See ${v.name}` : `About ${v.name}`);

function VentureCast({ v }: { v: Venture }) {
  const live = v.status === 'live';
  const href = ventureHref(v);
  return (
    <article className="vf-panel group" data-hot={live ? undefined : ''} aria-labelledby={`v-${v.slug}`}>
      <Link href={href} tabIndex={-1} aria-hidden className="vf-visual" data-pull="10">
        <VentureObject v={v} cue={cueFor(v)} />
      </Link>
      <div className="vf-text">
        <p className={`label flex items-center gap-2 ${live ? 'text-ember' : ''}`}>
          {live && <span aria-hidden className="live-dot size-1.5 rounded-full bg-ember" />}
          {live ? 'Live' : 'Coming soon'}
        </p>
        <h3 id={`v-${v.slug}`} className="vf-name">
          {v.name}
        </h3>
        {v.tagline && <p className="vf-tag">{v.tagline}</p>}
        <p className="vf-blurb">{v.blurb}</p>
        <Link href={href} className="vf-link mt-8">
          {cueFor(v)} <ArrowRight />
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
export function VentureObject({ v, sizes = '(min-width: 1024px) 44vw, 92vw', eager, cue }: { v: Venture; sizes?: string; eager?: boolean; cue?: string }) {
  if (hasMonolith(v.monolith)) return <MonolithStill name={v.monolith!} sizes={sizes} eager={eager} />;
  return hasIngot(v.ingot) ? <IngotScene slug={v.ingot!} sizes={sizes} eager={eager} cue={cue} /> : <MarkCast v={v} />;
}

/**
 * The venture's metal monolith, as the home page's world renders it (a transparent still cut at its glowing waterline,
 * 2:3). It stands on the page's own liquid: no floor, no box. Hover lifts it a little out of the liquid.
 */
function MonolithStill({ name, sizes, eager }: { name: string; sizes: string; eager?: boolean }) {
  const src = (w: number) => `/film/monoliths/${name}-${w}.webp`;
  // The still is 2:3 and fills its frame's height, so it is about two thirds of the frame's width (a 4:3 frame: half).
  const narrow = sizes.replace(/(\d+)vw/g, (_, n) => `${Math.round(+n / 2)}vw`);
  return (
    <span className="vm">
      {/* eslint-disable-next-line @next/next/no-img-element -- static export, the srcset is ours */}
      <img
        src={src(1200)}
        srcSet={`${src(600)} 600w, ${src(1200)} 1200w, ${src(2400)} 2400w`}
        sizes={narrow}
        width={1200}
        height={1800}
        alt=""
        draggable={false}
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : undefined}
        decoding="async"
        className="vm-img"
      />
    </span>
  );
}

/** The fallback visual (a venture without an ingot still): its mark, cool when live, glowing while it's forging. Verge's V is the
 * display face, as on its 3D bar (TODO(jakob): Verge's real mark). */
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
          <text x="256" y="420" fontFamily="var(--font-display)" fontSize="460" fontWeight="800" textAnchor="middle" fill="currentColor">
            V
          </text>
        </svg>
      )}
    </span>
  );
}
