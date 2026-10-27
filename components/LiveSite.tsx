export type Theme = 'cafe' | 'barber' | 'landscaper';

/**
 * The three concept sites (fictional businesses, see data/work.ts) as real, responsive HTML instead of screenshots.
 * Each lays out at a "virtual" viewport width (container queries reflow it for phones) and is scaled into its frame.
 * `blueprint` renders the same markup as a wireframe: outlines, labels and greeked text, for the casting effect.
 * Decorative: the caller labels the frame for screen readers and hides this from them.
 */
export function LiveSite({ theme, blueprint = false }: { theme: Theme; blueprint?: boolean }) {
  const cls = `ls ls-${theme} ${blueprint ? 'ls-bp' : ''}`;
  if (theme === 'cafe')
    return (
      <div className={cls}>
        <nav className="ls-nav" data-bp="Nav">
          <span className="ls-logo">
            <span className="tx">
              Halcyon <i>coffee</i>
            </span>
          </span>
          <span className="ls-links">
            <span>Menu</span>
            <span>Our beans</span>
            <span>Visit</span>
            <span>Catering</span>
          </span>
          <span className="ls-btn ls-nav-btn">Order ahead</span>
          <span className="ls-burger">
            <i />
            <i />
          </span>
        </nav>
        <div className="ls-hero">
          <div className="ls-copy" data-bp="Headline">
            <p className="ls-tag">
              <b /> <span className="tx">Open today · 7am–3pm</span>
            </p>
            <div className="ls-h1">
              <span className="tx">
                Slow mornings, <em>good coffee.</em>
              </span>
            </div>
            <p className="ls-lead">
              <span className="tx">A neighborhood café roasting small batches, baking every morning, and saving you the window seat.</span>
            </p>
            <div className="ls-ctas" data-bp="Buttons">
              <span className="ls-btn">See the menu</span>
              <span className="ls-ghost">Find us</span>
            </div>
          </div>
          <div className="ls-art" data-bp="Image">
            <div className="cafe-saucer" />
            <div className="cafe-handle" />
            <div className="cafe-cup">
              <div className="cafe-coffee" />
            </div>
            <div className="ls-card">
              <small>This week</small>
              <strong>Maple oat latte</strong>
            </div>
          </div>
        </div>
        <div className="ls-strip" data-bp="Menu">
          <span>
            <b>Espresso</b> from $3
          </span>
          <span>
            <b>Pastries</b> baked daily
          </span>
          <span>
            <b>Beans</b> roasted in-house
          </span>
          <span>
            <b>Wi-Fi</b> fast, free
          </span>
        </div>
      </div>
    );

  if (theme === 'barber')
    return (
      <div className={cls}>
        <nav className="ls-nav" data-bp="Nav">
          <span className="ls-logo">
            <span className="tx">
              Sharp <i>&amp;</i> Co.
            </span>
          </span>
          <span className="ls-links">
            <span>Services</span>
            <span>Barbers</span>
            <span>Shop</span>
            <span>Hours</span>
          </span>
          <span className="ls-btn ls-nav-btn">Book a chair</span>
          <span className="ls-burger">
            <i />
            <i />
          </span>
        </nav>
        <div className="ls-hero">
          <div className="ls-copy" data-bp="Headline">
            <p className="ls-tag">
              <span className="tx">Walk-ins welcome · Est. downtown</span>
            </p>
            <div className="ls-h1">
              <span className="tx">
                Clean cuts. <em>No fuss.</em>
              </span>
            </div>
            <p className="ls-lead">
              <span className="tx">Classic and modern cuts, hot towel shaves, and beard work by barbers who take their time.</span>
            </p>
            <div className="ls-ctas" data-bp="Buttons">
              <span className="ls-btn">Book in one tap</span>
              <span className="ls-ghost">See prices</span>
            </div>
          </div>
          <div className="ls-panel" data-bp="Prices">
            <div className="barber-pole" />
            <small>Services</small>
            <div className="ls-h2">The menu</div>
            {[
              ['Classic cut', 'Scissor or clipper, wash, style', '$30'],
              ['Skin fade', 'Detailed fade, line-up', '$35'],
              ['Hot towel shave', 'Straight razor, warm lather', '$40'],
              ['Beard trim', 'Shape, line, oil', '$20'],
            ].map(([name, note, price]) => (
              <div key={name} className="barber-row">
                <span>
                  {name}
                  <em>{note}</em>
                </span>
                <i />
                <b>{price}</b>
              </div>
            ))}
            <p className="barber-foot">Tue–Sat · 9am–7pm</p>
          </div>
        </div>
      </div>
    );

  return (
    <div className={cls}>
      <div className="land-top">
        <div className="land-sun" data-bp="Illustration" />
        <svg className="land-hills" viewBox="0 0 1440 420" preserveAspectRatio="none">
          <path d="M0 230 C260 150 420 120 640 170 S1050 260 1440 140 V420 H0Z" fill="#A9C29A" />
          <path d="M0 300 C300 230 520 250 760 280 S1180 230 1440 250 V420 H0Z" fill="#6F9A6A" />
          <path d="M0 360 C340 320 640 340 900 350 S1260 320 1440 330 V420 H0Z" fill="#2E5A3C" />
        </svg>
        <nav className="ls-nav" data-bp="Nav">
          <span className="ls-logo">
            <i className="land-mark" />
            <span className="tx">Fieldstone</span>
          </span>
          <span className="ls-links">
            <span>Services</span>
            <span>Our work</span>
            <span>Seasonal</span>
            <span>About</span>
          </span>
          <span className="ls-btn ls-nav-btn">Free estimate</span>
          <span className="ls-burger">
            <i />
            <i />
          </span>
        </nav>
        <div className="ls-copy" data-bp="Headline">
          <p className="ls-tag">
            <span className="tx">Licensed &amp; insured · Serving the whole county</span>
          </p>
          <div className="ls-h1">
            <span className="tx">
              Yards worth <em>coming home to.</em>
            </span>
          </div>
          <p className="ls-lead">
            <span className="tx">Design, planting, patios and weekly care, from a local crew that shows up when we say we will.</span>
          </p>
          <div className="ls-ctas" data-bp="Buttons">
            <span className="ls-btn">Get a free estimate</span>
            <span className="ls-ghost">See our work</span>
          </div>
        </div>
      </div>
      <div className="land-services" data-bp="Services">
        {[
          ['Lawn care', 'Weekly mowing, edging and seasonal feeding.'],
          ['Planting', 'Beds, shrubs and trees chosen for your soil.'],
          ['Hardscaping', 'Patios, walls and paths built to last.'],
          ['Cleanups', 'Spring and fall, done in a day.'],
        ].map(([name, body]) => (
          <div key={name} className="land-card">
            <i />
            <b>{name}</b>
            <span>{body}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
