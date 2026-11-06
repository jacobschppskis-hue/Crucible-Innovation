// Two visual tiers, chosen at runtime.
//
// `rich` is what every visitor gets (Jacob's call: always the full version, never a low-bandwidth one): the rendered
// films (lib/film.ts, a 2D canvas) and the WebGL scenes (lib/gl/*), loaded once the page is up and idle so they never
// hold back the first paint. A scene that runs slow lowers its own quality; it doesn't give up.
//
// `light` (CSS, SVG and the films' posters) is what's left for visitors who ask for reduced motion, without JS, and for
// a scene that can't start at all (no WebGL, a lost context). `?tier=rich|light` forces one (tests and demos).

/** Runs inline in <head>: sets html.js, data-tier and data-intro before first paint. Keep it tiny and ES5. */
export const TIER_SCRIPT = `(function(d,w){d.classList.add('js');var q=/[?&]tier=(rich|light)/.exec(location.search);d.setAttribute('data-tier',q?q[1]:w.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches?'light':'rich');try{if(/^\\/(index\\.html)?$/.test(location.pathname)){if(sessionStorage.getItem('crucible:lit'))d.setAttribute('data-intro','quick');else sessionStorage.setItem('crucible:lit','1');d.setAttribute('data-pour','');setTimeout(function(){d.setAttribute('data-go','')},3500)}}catch(e){}})(document.documentElement,window)`;

let verdict: Promise<boolean> | undefined;

/** Resolves true after load + idle when this visit is rich (every visit, unless reduced motion or ?tier=light). */
export function richTier(): Promise<boolean> {
  verdict ??= new Promise<boolean>((resolve) => {
    if (document.documentElement.dataset.tier !== 'rich') return resolve(false);
    afterIdle(() => resolve(true));
  });
  return verdict;
}

/**
 * Resolves on the visitor's first scroll, pointer move, tap or key press. For effects that only answer what the visitor
 * does: they start then, so a page that is only loaded (a slow phone's first seconds, Lighthouse) never pays for them.
 */
export function firstUse(): Promise<void> {
  return new Promise((resolve) => {
    const events = ['scroll', 'pointermove', 'pointerdown', 'keydown'];
    const go = () => {
      for (const e of events) removeEventListener(e, go);
      resolve();
    };
    for (const e of events) addEventListener(e, go, { passive: true });
  });
}

/** Called by a scene that can't run at all (no WebGL, context lost): its light version stays. */
export function dropToLight() {
  document.documentElement.dataset.tier = 'light';
}

/** Sets html[data-fonts] once the page is loaded and idle. The concept sites' faces (lib/conceptFonts.ts) are held back
 * until then (LiveSite.css), so their ~31 KB don't compete with the scripts that start the page. Runs for every tier. */
let fontsQueued = false;
export function releaseConceptFonts() {
  if (fontsQueued) return;
  fontsQueued = true;
  afterIdle(() => document.documentElement.setAttribute('data-fonts', ''));
}

function afterIdle(fn: () => void) {
  const idle = () => (window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 300)))(fn, { timeout: 2500 });
  if (document.readyState === 'complete') idle();
  else addEventListener('load', idle, { once: true });
}

/** Runs `fn` once, when `el` is within `margin` (CSS rootMargin) of the viewport; returns the cancel. A far-off scene
 * (Thesis flames, footer furnace) then creates its GL context when you near it, not during the page's first seconds. */
export function whenNear(el: Element, fn: () => void, margin = '150% 0px 150% 0px'): () => void {
  if (typeof IntersectionObserver === 'undefined') {
    fn();
    return () => {};
  }
  const io = new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting)) {
      io.disconnect();
      fn();
    }
  }, { rootMargin: margin });
  io.observe(el);
  return () => io.disconnect();
}
