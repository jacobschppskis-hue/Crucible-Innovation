import { Fragment, type CSSProperties } from 'react';
import './Process.css';

// The facts are the FAQ's (data/faq.ts): a first draft in about three days, two rounds of edits, live in about a week.
// `from`/`to` are the days (on the scrubbed timeline) while each step is the one being read.
const steps = [
  { when: 'Day 1', name: 'The call', body: 'A 15-minute call about your business, your customers and what isn’t working today.', from: -1, to: 1 },
  { when: 'Day 3', name: 'First draft', body: 'A real, clickable draft of your site in about three days. Not a mood board.', from: 1, to: 3 },
  { when: 'Days 4 to 6', name: 'Two rounds of edits', body: 'We temper the words, photos and details together until it feels like you.', from: 3, to: 6 },
  { when: 'Day 7', name: 'Launch', body: 'Domain, hosting and help with your Google listing. Then you’re live.', from: 6, to: 99 },
];

// What the call leaves us with, for the fictional business the frame builds (the Fieldstone concept, data/work.ts).
const notes = [
  ['Business', 'Fieldstone Landscaping'],
  ['What they do', 'Design, planting, patios and weekly care'],
  ['Customers', 'Homeowners across the county'],
];

const DAYS = [1, 2, 3, 4, 5, 6, 7];
const vars = (v: Record<string, number>) => v as CSSProperties;

/**
 * Process on /sites: seven days you can scrub. A pinned scene (data-scroll="pin" → --p, eased by lib/scroll.ts)
 * runs a day counter from Day 1 to Day 7 while a website is made by hand in the browser frame beside it: the notes
 * from the call, a blank page poured in, layout lines snapped into place, the type set word by word, a photo placed
 * and cropped, a colour picked, then two rounds of edits (the headline, the photo, the colour) and the address fills in
 * as it goes live. Pure CSS off one variable (components/Process.css), so it ships no JavaScript of its own. With
 * reduced motion, on short screens and without JS it is a plain list of the days beside the finished site.
 */
export function Process() {
  return (
    <div data-scroll="pin" className="days-pin">
      <div className="days-sticky">
        <div className="days-stage container-x">
          <div className="days-text">
            <p aria-hidden className="days-count">
              <span>Day</span>
              <span className="days-num">
                {DAYS.map((n) => (
                  <span key={n} style={vars({ '--n': n })}>
                    {n}
                  </span>
                ))}
              </span>
            </p>
            <div aria-hidden className="days-rail">
              {DAYS.map((n) => (
                <i key={n} style={vars({ '--i': n - 1 })} />
              ))}
            </div>
            <ol className="days-steps">
              {steps.map((s) => (
                <li key={s.name} className="days-step" style={vars({ '--a': s.from, '--b': s.to })}>
                  <p className="days-when label">{s.when}</p>
                  <h3 className="days-name">{s.name}</h3>
                  <p className="days-body">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>

          <figure
            className="days-shot"
            role="img"
            aria-label="A concept website for a fictional landscaper, made over a week: the notes from the call, a blank page, layout lines, the type set, a photo placed and cropped, a colour picked, two rounds of edits to the headline, the photo and the colour, then live at its own address."
          >
            <div aria-hidden data-unslop-ok className="days-frame">
              <div className="days-bar">
                <span className="days-dots">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="days-url">
                  <span className="days-addr">yourbusiness.com</span>
                  <span className="days-live">
                    <i className="live-dot" />
                    Live
                  </span>
                </span>
                <span className="days-concept">Concept</span>
              </div>
              <div className="days-screen">
                <div className="days-notes">
                  {notes.map(([k, v], i) => (
                    <div key={k} className="days-note" style={vars({ '--i': i })}>
                      <span>{k}</span>
                      <b>{v}</b>
                    </div>
                  ))}
                </div>
                <div className="cast-layer days-board">
                  <div className="cast-in">
                    <Site />
                  </div>
                </div>
                <div className="cast-track days-front">
                  <div className="cast-band" />
                  <div className="cast-front" />
                </div>
              </div>
            </div>
          </figure>
        </div>
      </div>
    </div>
  );
}

// The two pictures, drawn in SVG and painted as backgrounds, so they add nothing to restyle while the scene scrubs.
// Both keep what matters inside x 60–340, y 75–225, which survives the crop in a tall (desktop) and a wide (phone) box.
const picture = (body: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'>${body}</svg>`)}")`;

// The draft's stock picture: hills and a sun.
const STOCK = picture(
  `<rect width='400' height='300' fill='#dce6d3'/><circle cx='272' cy='112' r='30' fill='#edb75a'/>` +
    `<path d='M0 170C80 130 150 120 230 150S340 180 400 120V300H0Z' fill='#a9c29a'/>` +
    `<path d='M0 205C90 172 180 182 260 196S350 182 400 186V300H0Z' fill='#6f9a6a'/>` +
    `<path d='M0 240C100 220 210 228 300 234S370 224 400 228V300H0Z' fill='#2e5a3c'/>`,
);

// Round one swaps it for a photo of their own work: a stepping-stone path across a lawn, a tree and a planted bed.
const stones = [
  [214, 286, 62, 13],
  [209, 250, 50, 10.5],
  [204, 221, 39, 8],
  [200, 199, 30, 6],
  [197, 182, 23, 4.5],
  [195, 169, 17, 3.5],
];
const flowers: [number, number, string][] = [
  [86, 194, '#e8a33d'],
  [104, 189, '#d9774f'],
  [122, 192, '#e8a33d'],
  [138, 198, '#d9774f'],
];
const THEIRS = picture(
  `<rect width='400' height='300' fill='#e6ece0'/>` +
    `<path d='M0 150C40 120 70 134 104 126S168 108 208 124S300 104 400 120V160H0Z' fill='#2e5a3c'/>` +
    `<rect y='152' width='400' height='148' fill='#86a86f'/><path d='M0 152H400V164C300 158 120 160 0 168Z' fill='#6f9a6a'/>` +
    stones.map(([cx, cy, rx, ry]) => `<ellipse cx='${cx}' cy='${cy}' rx='${rx}' ry='${ry}' fill='#ece6d6'/>`).join('') +
    `<rect x='270' y='110' width='8' height='58' fill='#5b4636'/><circle cx='274' cy='100' r='30' fill='#3f6b47'/>` +
    `<circle cx='298' cy='118' r='20' fill='#2e5a3c'/><ellipse cx='110' cy='200' rx='46' ry='14' fill='#2e5a3c'/>` +
    flowers.map(([cx, cy, fill]) => `<circle cx='${cx}' cy='${cy}' r='4.5' fill='${fill}'/>`).join(''),
);

// When each piece is set on Day 2 (in days on the timeline, read by .fs-set in Process.css).
const at = (t: number) => vars({ '--t': t });
// A line of type set a word at a time, with a hot caret after the word just set (the last one keeps it a moment).
const words = (text: string, t0: number, dt: number) =>
  text.split(' ').map((w, i, all) => (
    <Fragment key={i}>
      <span className="fs-w" style={vars({ '--t': t0 + i * dt, '--dt': i < all.length - 1 ? dt : 0.14 })}>
        {w}
      </span>
      {i < all.length - 1 ? ' ' : ''}
    </Fragment>
  ));

/**
 * The site being made, in HTML, in its finished state; Process.css takes it back to a blank page and builds it up
 * piece by piece. The guides (.fs-guide) are the layout lines, drawn from the edges of the blocks they lay out.
 */
function Site() {
  return (
    <div className="fs">
      <div className="fs-nav">
        <span className="fs-logo">
          <i className="fs-mark fs-set" style={at(1.8)} />
          <span className="fs-set" style={at(1.84)}>
            Fieldstone
          </span>
        </span>
        <span className="fs-links">
          {['Services', 'Our work', 'About'].map((l, i) => (
            <span key={l} className="fs-set" style={at(1.88 + i * 0.03)}>
              {l}
            </span>
          ))}
        </span>
        <span className="fs-btn fs-nav-btn fs-set" style={at(1.97)}>
          Free estimate
        </span>
        <span className="fs-burger fs-set" style={at(1.97)}>
          <i />
          <i />
        </span>
        <i className="fs-guide fs-gx" style={vars({ '--k': 0 })} />
      </div>
      <div className="fs-hero">
        <div className="fs-copy">
          <i className="fs-guide fs-gy" style={vars({ '--k': 1 })} />
          <p className="fs-tag fs-set" style={at(2.02)}>
            Serving the whole county
          </p>
          {/* Round one of edits rewrites the draft's headline. */}
          <div className="fs-h1 fs-edit">
            <span className="fs-v1">{words('Landscaping you can count on', 2.08, 0.045)}</span>
            <span className="fs-v2">{words('Yards worth coming home to', 3.5, 0.06)}</span>
          </div>
          <p className="fs-lead fs-set" style={at(2.32)}>
            Design, planting, patios and weekly care, from a local crew that shows up.
          </p>
          <div className="fs-ctas">
            <span className="fs-btn fs-cta fs-edit fs-set" style={at(2.4)}>
              Get a free estimate
            </span>
            <span className="fs-ghost fs-set" style={at(2.44)}>
              See our work
            </span>
            {/* The colour being picked: on Day 3 the draft's green, in round two the deeper one they asked for. */}
            <span className="fs-swatch">
              <i />
              <i />
              <i />
              <b />
            </span>
          </div>
        </div>
        <div className="fs-pic fs-edit">
          <i className="fs-guide fs-gy fs-gl" style={vars({ '--k': 2 })} />
          <i className="fs-guide fs-gy fs-gr" style={vars({ '--k': 3 })} />
          <i className="fs-guide fs-gx fs-gt" style={vars({ '--k': 4 })} />
          <i className="fs-guide fs-gx fs-gb" style={vars({ '--k': 5 })} />
          <i className="fs-pic-a">
            <b style={{ backgroundImage: STOCK }} />
          </i>
          <i className="fs-pic-b" style={{ backgroundImage: THEIRS }} />
          <i className="fs-crop" />
        </div>
      </div>
    </div>
  );
}
