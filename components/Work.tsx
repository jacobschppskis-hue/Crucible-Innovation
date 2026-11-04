import type { ClientSite, Work } from '@/data/work';
import { LiveSite, type Theme } from './LiveSite';
import { SplitRing } from './SplitRing';

/*
 * The /work list (app/work/page.tsx): one plate per item, caption on top and the work itself below, as large as the
 * screen allows. On wide screens the plates stack: each sticks under the nav and the next slides up over it, its
 * leading edge hot while it moves and cooling as it settles (--p from data-scroll="enter"). On phones, with reduced
 * motion and on short screens it's a plain list. Styles: components/Work.css.
 */

type PlateProps = {
  /** Position in its stack: the z-index, so each plate covers the one before it. */
  i: number;
  id: string;
  label: React.ReactNode;
  name: string;
  note: React.ReactNode;
  children: React.ReactNode;
};

export function Plate({ i, id, label, name, note, children }: PlateProps) {
  return (
    <article aria-labelledby={id} data-scroll="enter" className="wk-plate" style={{ '--i': i + 1 } as React.CSSProperties}>
      <div className="container-x">
        <div className="wk-cap">
          <div>
            <p className="label flex items-center gap-2">{label}</p>
            <h3 id={id} className="wk-name">
              {name}
            </h3>
          </div>
          <div className="wk-note">{note}</div>
        </div>
        <div className="wk-media">{children}</div>
      </div>
    </article>
  );
}

/** Browser chrome. The address is real data (a live site's host), so it's the one place mono is used. */
function Chrome({ host }: { host?: string }) {
  return (
    <div aria-hidden className="wk-chrome">
      <span className="wk-dots">
        <i />
        <i />
        <i />
      </span>
      {host && <span className="wk-url">{host}</span>}
    </div>
  );
}

/**
 * A concept site, live: the desktop layout in a browser and the phone layout in a phone the visitor can scroll. Each is
 * cast on first view: the blueprint is the mould and the finished site pours in behind an Ember front ([data-cast],
 * the shared .cast-* classes). The sites themselves are decorative HTML (components/LiveSite.tsx); the frames carry
 * the description.
 */
export function ConceptDevices({ w }: { w: Work }) {
  const theme = w.slug as Theme;
  // On phones the desktop layout would be scaled to unreadable type, so the browser shows its screenshot there
  // (public/showcase, rendered from the same design) and only the phone is live.
  const still = (s: number) => w.image.replace(/\.webp$/, `-${s}.webp`);
  return (
    <div className="wk-devices">
      <div role="img" aria-label={w.alt} className="wk-browser">
        <Chrome />
        <div className="wk-screen ls-vp">
          <div data-cast="" className="wk-cast">
            <div aria-hidden className="cast-layer wk-bp">
              <LiveSite theme={theme} blueprint />
            </div>
            <div aria-hidden className="cast-layer cast-piece">
              <div className="cast-in">
                <LiveSite theme={theme} />
              </div>
            </div>
            <Front />
          </div>
          <img
            src={still(960)}
            srcSet={`${still(640)} 640w, ${still(960)} 960w`}
            sizes="92vw"
            width={1440}
            height={900}
            alt=""
            loading="lazy"
            decoding="async"
            className="wk-shot wk-still"
          />
        </div>
      </div>
      <div className="wk-phone" data-layout="phone">
        <div data-cast="" className="wk-phone-screen ls-vp" style={{ '--cast-delay': '500ms' } as React.CSSProperties}>
          <div aria-hidden className="cast-layer wk-bp">
            <LiveSite theme={theme} blueprint />
          </div>
          <div className="cast-layer cast-piece">
            <div className="cast-in">
              <div role="group" aria-label={`${w.name} on a phone. Scrolls.`} tabIndex={0} data-lenis-prevent="" className="wk-scroll">
                <div aria-hidden className="wk-flow ls-vp">
                  <LiveSite theme={theme} />
                </div>
              </div>
            </div>
          </div>
          <Front />
        </div>
        <span aria-hidden className="wk-island" />
      </div>
    </div>
  );
}

function Front() {
  return (
    <div aria-hidden className="cast-track">
      <div className="cast-band" />
      <div className="cast-front" />
    </div>
  );
}

/** Screenshots in the same frames (Crucible's own site). `src` is the desktop shot; `phone` the phone one. */
export function ShotDevices({ host, desktop, phone }: { host: string; desktop: Shot; phone: Shot }) {
  return (
    <div className="wk-devices">
      <div className="wk-browser">
        <Chrome host={host} />
        <div className="wk-screen">
          <Img shot={desktop} sizes="(min-width: 1024px) 56rem, 92vw" className="wk-shot" />
        </div>
      </div>
      <div className="wk-phone">
        <div className="wk-phone-screen">
          <Img shot={phone} sizes="18rem" className="wk-shot" />
        </div>
        <span aria-hidden className="wk-island" />
      </div>
    </div>
  );
}

export type Shot = { src: string; widths: number[]; width: number; height: number; alt: string };

/** A pre-sized image from public/work (GitHub Pages can't resize): `name-<w>.webp` for each width. */
export function Img({ shot, sizes, className }: { shot: Shot; sizes: string; className?: string }) {
  const at = (w: number) => shot.src.replace(/\.webp$/, `-${w}.webp`);
  const largest = shot.widths[shot.widths.length - 1];
  return (
    <img
      src={at(largest)}
      srcSet={shot.widths.map((w) => `${at(w)} ${w}w`).join(', ')}
      sizes={sizes}
      width={shot.width}
      height={shot.height}
      alt={shot.alt}
      loading="lazy"
      decoding="async"
      className={className}
    />
  );
}

/** The business card, front and back as printed (trim size, no bleed). The back sits over the front's empty corner. */
export function CardPair({ front, back }: { front: Shot; back: Shot }) {
  return (
    <div className="wk-cards">
      <Img shot={front} sizes="(min-width: 1024px) 44rem, 92vw" className="wk-card wk-card-front" />
      <Img shot={back} sizes="(min-width: 1024px) 34rem, 92vw" className="wk-card wk-card-back" />
    </div>
  );
}

/** The Split Ring, set and cooled in its mould (the foundry floor's .vf-mould), and the sizes it has to hold at. */
export function MarkMould() {
  return (
    <div className="wk-mould">
      <span className="vf-mould">
        <SplitRing size="58%" title="The Split Ring, Crucible’s mark" />
      </span>
    </div>
  );
}

export function MarkSizes() {
  return (
    <ul aria-label="The mark at small sizes" className="wk-sizes">
      {[48, 32, 16].map((s) => (
        <li key={s}>
          <SplitRing size={s} title="" />
          <span className="label">{s} px</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * A published client site in a browser: the live site itself when it can be framed (`embed`), else its screenshot.
 * The screenshot also sits under the frame as a poster while the live site loads.
 */
export function ClientFrame({ c }: { c: ClientSite }) {
  const host = new URL(c.url).hostname.replace(/^www\./, '');
  return (
    <div className="wk-browser wk-browser-solo">
      <Chrome host={host} />
      <div className={`wk-screen ${c.embed ? 'wk-screen-live' : ''}`}>
        {c.image && <img src={c.image} alt={c.embed ? '' : `The ${c.name} website`} loading="lazy" decoding="async" className="wk-shot" />}
        {c.embed ? (
          <iframe
            src={c.url}
            title={`The ${c.name} website, live`}
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-popups"
            referrerPolicy="strict-origin-when-cross-origin"
            className="wk-embed"
          />
        ) : (
          !c.image && <span className="wk-host wide">{host}</span>
        )}
      </div>
    </div>
  );
}
