// Two visual tiers, chosen at runtime.
//
// `light` is the default and needs nothing: CSS, SVG and a 2D canvas. `rich` adds WebGL scenes, loaded only
// after the page is up and idle, and only on a device that proves it can carry them:
//
// 1. Before first paint, an inline script in app/layout.tsx (TIER_SCRIPT) makes a provisional call from what the
//    browser reveals for free: reduced motion / reduced data, Save-Data, a slow effective connection (Chromium),
//    little memory (Chromium) or few cores. Anything doubtful stays `light`. `?tier=rich|light` overrides it.
// 2. After load + idle, richTier() confirms it: a real WebGL context without a "major performance caveat" and not a
//    software rasterizer, a download speed measured from this page's own files (works in Safari, which has no
//    Network Information API), and a short frame-time probe. Failing any of these drops back to `light`.
// 3. Each WebGL scene also watches its own frame times and steps down (lower resolution, then back to the light
//    tier) if the device can't keep up.

/** Runs inline in <head>: sets html.js, data-tier and data-intro before first paint. Keep it tiny and ES5. */
export const TIER_SCRIPT = `(function(d,n,w){d.classList.add('js');var t,q=/[?&]tier=(rich|light)/.exec(location.search);function m(s){return w.matchMedia&&matchMedia(s).matches}if(q)t=q[1];else{var c=n.connection,mem=n.deviceMemory,cpu=n.hardwareConcurrency;var slow=c&&(c.saveData||/2g|3g/.test(c.effectiveType||'')||c.downlink&&c.downlink<1.5||c.rtt&&c.rtt>400);t=m('(prefers-reduced-motion: reduce)')||m('(prefers-reduced-data: reduce)')||slow||mem&&mem<4||cpu&&cpu<4?'light':'rich'}d.setAttribute('data-tier',t);try{if(/^\\/(index\\.html)?$/.test(location.pathname)){if(sessionStorage.getItem('crucible:lit'))d.setAttribute('data-intro','quick');else sessionStorage.setItem('crucible:lit','1')}}catch(e){}})(document.documentElement,navigator,window)`;

let verdict: Promise<boolean> | undefined;

/** `?tier=rich` forces the rich tier (demos, testing): scenes still lower their quality but never give up. */
export const richForced = () => /[?&]tier=rich/.test(location.search);

/** Resolves true once the rich tier is confirmed (after load + idle), false if this visit stays light. */
export function richTier(): Promise<boolean> {
  verdict ??= new Promise<boolean>((resolve) => {
    const d = document.documentElement;
    if (d.dataset.tier !== 'rich') return resolve(false);
    afterIdle(async () => {
      const ok = richForced() || (webglOk() && networkOk() && (await framesOk()));
      if (!ok) d.dataset.tier = 'light';
      resolve(ok);
    });
  });
  return verdict;
}

/** Called by a scene that had to give up at runtime (too slow, context lost). */
export function dropToLight() {
  document.documentElement.dataset.tier = 'light';
}

function afterIdle(fn: () => void) {
  const idle = () => (window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 300)))(fn, { timeout: 2500 });
  if (document.readyState === 'complete') idle();
  else addEventListener('load', idle, { once: true });
}

function webglOk() {
  try {
    const gl = document.createElement('canvas').getContext('webgl', { failIfMajorPerformanceCaveat: true });
    if (!gl) return false;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    const big = gl.getParameter(gl.MAX_TEXTURE_SIZE) >= 4096;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return big && !/swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer);
  } catch {
    return false;
  }
}

/** Download speed of this page's own files. Cached files cost nothing, so they don't count against it. */
function networkOk() {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (c?.saveData || /2g|3g/.test(c?.effectiveType ?? '')) return false;
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (nav && nav.responseStart - nav.requestStart > 800) return false; // very high latency
  let bytes = 0;
  let ms = 0;
  for (const e of performance.getEntriesByType('resource') as PerformanceResourceTiming[]) {
    if (!e.name.startsWith(location.origin) || e.transferSize < 8000) continue;
    bytes += e.transferSize;
    ms += Math.max(1, e.responseEnd - e.responseStart);
  }
  if (bytes < 30000) return true; // too little transferred to judge (mostly cached)
  return (bytes * 8) / ms / 1000 >= 2; // ≥ 2 Mbit/s
}

/** ~24 frames: the median frame must be under 22 ms and no more than a few may be long. */
function framesOk() {
  return new Promise<boolean>((resolve) => {
    const times: number[] = [];
    let last = 0;
    const tick = (now: number) => {
      if (last) times.push(now - last);
      last = now;
      if (times.length < 24) return requestAnimationFrame(tick);
      const sorted = [...times].sort((a, b) => a - b);
      const long = times.filter((t) => t > 50).length;
      resolve(sorted[12] < 22 && long <= 2);
    };
    requestAnimationFrame(tick);
  });
}
