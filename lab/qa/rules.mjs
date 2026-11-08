// Jacob's named failure modes (plan/final/JACOB.md §4.7, §5) as machine checks.
// domRules(): evaluated in the page; returns [{sev, rule, text}]. pixelRules(png): lava specks, Quench share.
import { raw, relLum } from './lib.mjs';

// ---- in-page (serialisable: no closures over module scope) ----
export function domRules(opts = {}) {
  const out = [];
  const add = (sev, rule, text) => out.push({ sev, rule, text: String(text).replace(/\s+/g, ' ').trim().slice(0, 140) });
  const visibleText = (root) => {
    // text a reader gets: skip aria-hidden decorations and scripts
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let s = '';
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const el = n.parentElement;
      if (!el || el.closest('script,style,noscript,template,[aria-hidden="true"]')) continue;
      s += n.textContent + ' ';
    }
    return s.replace(/\s+/g, ' ');
  };
  const body = visibleText(document.body);
  // hard copy rules
  const legal = body.match(/\b(LLC|incorporated|venmo|zelle|cash ?app)\b/i);
  if (legal) add('P0', 'never write LLC/incorporated/payment details', legal[0]);
  // Jacob's line appears once (only meaningful on the home page, which carries his story)
  const once = (body.match(/comes together earlier/g) || []).length;
  if (once > 1) add('P0', `"comes together earlier" appears ${once}x (must be once)`, 'I want to know what happens when a group like it comes together earlier.');
  if (opts.home && once === 0) add('P1', 'Jacob\'s line "...comes together earlier." is missing from the home page', '');
  // the take-apart beats are gone
  const beats = body.match(/Not the person|Not the model|Neither, alone/);
  if (beats) add('P0', 'take-apart beat copy is back', beats[0]);
  // PayPal captions: Elon funded SpaceX and invested in Tesla; PayPal people did not found them
  for (const m of body.matchAll(/[^.!?]*\b(found|co-?found|start|creat|built)\w*\b[^.!?]{0,90}\b(Tesla|SpaceX)\b[^.!?]*/gi)) add('P1', 'PayPal facts: Tesla/SpaceX were funded/invested in by Elon, not founded by PayPal people', m[0]);
  for (const m of body.matchAll(/[^.!?]*\b(Tesla|SpaceX)\b[^.!?]{0,40}\b(founded|started|created)\b[^.!?]*/gi)) add('P1', 'PayPal facts: Tesla/SpaceX were funded/invested in by Elon, not founded by PayPal people', m[0]);
  // facts we can't back: numbers that aren't in his story
  for (const m of body.matchAll(/\b\d{2,3}(?:\.\d)?\s?%|\b\d+[kKmM]\+?\s+(?:users|customers|clients|sites)\b/g)) add('P2', 'a stat: check it is in Jacob\'s text (no invented numbers)', m[0]);

  const alphaOf = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return c === 'transparent' ? 0 : 1; const p = m[1].split(/[ ,/]+/).filter(Boolean); return p.length > 3 ? parseFloat(p[3]) : 1; };
  const rgbOf = (c) => (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  const isEmber = (c) => { const [r, g, b] = rgbOf(c); return alphaOf(c) > 0.4 && r > 200 && g > 50 && g < 140 && b < 90; };
  const interactive = 'a,button,input,select,textarea,label,summary,[role=button],[role=link],.btn,form,dialog,[data-mono-ok]';
  const textEls = [];
  for (const el of document.querySelectorAll('main *, footer *')) {
    if (el.closest('nav,header,svg,script,style,noscript,[aria-hidden="true"]')) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (own) textEls.push(el);
  }
  // nothing behind text: no backgrounds, scrims, glows, masks or text-shadow on text or its non-interactive ancestors
  const flagged = new Set();
  for (const el of textEls) {
    for (let a = el; a && a !== document.body && a.tagName !== 'MAIN'; a = a.parentElement) {
      if (flagged.has(a) || a.matches(interactive) || a.closest(interactive)) break;
      const cs = getComputedStyle(a);
      const why = [];
      if (alphaOf(cs.backgroundColor) > 0.02) why.push('background ' + cs.backgroundColor);
      if (cs.backgroundImage !== 'none' && !/^url\(/.test(cs.backgroundImage)) why.push('background-image gradient');
      if (cs.backdropFilter && cs.backdropFilter !== 'none') why.push('backdrop-filter ' + cs.backdropFilter);
      if (cs.webkitBackdropFilter && cs.webkitBackdropFilter !== 'none') why.push('backdrop-filter');
      if (cs.maskImage && cs.maskImage !== 'none') why.push('mask-image');
      if (cs.webkitMaskImage && cs.webkitMaskImage !== 'none' && !why.includes('mask-image')) why.push('mask-image');
      if (a === el && cs.textShadow !== 'none') why.push('text-shadow ' + cs.textShadow.slice(0, 40));
      if (cs.boxShadow !== 'none' && /\b([2-9]\d|\d{3})px/.test(cs.boxShadow)) why.push('large box-shadow');
      if (cs.filter && /drop-shadow|blur/.test(cs.filter)) why.push('filter ' + cs.filter.slice(0, 40));
      if (why.length) { flagged.add(a); add('P1', 'something behind text (Jacob: no backgrounds/masks/scrims/glows behind text)', `<${a.tagName.toLowerCase()}${a.className ? ' .' + String(a.className).split(' ')[0] : ''}> ${why.join(', ')} — "${el.textContent.trim().slice(0, 40)}"`); break; }
    }
  }
  // no gradient text (the only historic exception: .ig-cool "alloyed")
  for (const el of textEls) {
    const cs = getComputedStyle(el);
    if ((cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text') && !el.closest('.ig-cool')) add('P1', 'gradient text', el.textContent);
  }
  // one family: Archivo (mono only for real data marked data-mono-ok); headings without periods; no wide-tracked caps
  const fams = new Map();
  for (const el of textEls) {
    const f = getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim();
    if (!/archivo/i.test(f) && !el.closest('[data-mono-ok]')) fams.set(f, el.textContent.trim().slice(0, 30));
  }
  for (const [f, t] of fams) add('P2', `font family "${f}" (Archivo only; mono only for real data with data-mono-ok)`, t);
  for (const h of document.querySelectorAll('main h1, main h2, main h3')) {
    const t = h.textContent.trim();
    if (/[^.]\.$/.test(t)) add('P2', 'heading ends with a period', t);
  }
  for (const el of textEls) {
    const cs = getComputedStyle(el);
    if (cs.textTransform === 'uppercase' && parseFloat(cs.letterSpacing) / parseFloat(cs.fontSize) > 0.06) add('P2', 'wide-tracked caps', el.textContent);
  }
  // the nav is opaque, never translucent or blurred
  for (const n of document.querySelectorAll('body > nav, body > header, header nav, nav[aria-label]')) {
    const cs = getComputedStyle(n);
    if ((cs.backdropFilter && cs.backdropFilter !== 'none') || (alphaOf(cs.backgroundColor) > 0 && alphaOf(cs.backgroundColor) < 0.99)) add('P1', 'translucent/blurred nav (shows a grey box over bright 3D)', `${cs.backgroundColor} ${cs.backdropFilter}`);
  }
  // Ember budget in the current viewport: about 3 Ember things per screen
  if (opts.emberCount) {
    const things = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || +cs.opacity < 0.3) continue;
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if ((own && isEmber(cs.color)) || isEmber(cs.backgroundColor) || (parseFloat(cs.borderTopWidth) > 0 && isEmber(cs.borderTopColor)) || (el.tagName === 'circle' || el.tagName === 'rect' || el.tagName === 'path') && isEmber(cs.fill)) {
        if (!things.some((t) => t.contains(el) || el.contains(t))) things.push(el);
      }
    }
    out.push({ sev: 'info', rule: 'ember-things', n: things.length, text: things.map((t) => `${t.tagName.toLowerCase()}${t.className && typeof t.className === 'string' ? '.' + t.className.split(' ')[0] : ''}`).join(' ') });
  }
  return out;
}

// ---- pixels ----
// specks: small dark spots inside hot lava (the "dark crust plates ... specks ... sharp, dark mottled" Jacob called dirty).
// A pixel is a speck if it is much darker than the hot surface around it while that surround is mostly hot.
export async function pixelRules(png) {
  const { data, w, h } = await raw(png);
  const S = 2, W = Math.floor(w / S), H = Math.floor(h / S);
  const L = new Float32Array(W * H), hot = new Uint8Array(W * H), cool = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = ((y * S) * w + x * S) * 3, r = data[i], g = data[i + 1], b = data[i + 2];
    const k = y * W + x;
    L[k] = relLum(r, g, b);
    hot[k] = r > 70 && r > g * 1.25 && g >= b ? 1 : 0;
    cool[k] = b > 90 && b > r + 25 && b >= g ? 1 : 0;
  }
  // integral images of hot count and hot luminance
  const R = 4, ic = new Float64Array((W + 1) * (H + 1)), il = new Float64Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = y * W + x, j = (y + 1) * (W + 1) + x + 1;
    ic[j] = hot[k] + ic[j - 1] + ic[j - W - 1] - ic[j - W - 2];
    il[j] = hot[k] * L[k] + il[j - 1] + il[j - W - 1] - il[j - W - 2];
  }
  const box = (I, x0, y0, x1, y1) => I[y1 * (W + 1) + x1] - I[y0 * (W + 1) + x1] - I[y1 * (W + 1) + x0] + I[y0 * (W + 1) + x0];
  let hotN = 0, speck = 0, coolN = 0;
  for (let y = R; y < H - R; y++) for (let x = R; x < W - R; x++) {
    const k = y * W + x;
    if (cool[k]) coolN++;
    const n = box(ic, x - R, y - R, x + R + 1, y + R + 1);
    if (n < (2 * R + 1) ** 2 * 0.7) continue; // surround must be mostly hot lava
    hotN++;
    const mean = box(il, x - R, y - R, x + R + 1, y + R + 1) / n;
    if (mean > 0.03 && L[k] < mean * 0.3) speck++;
  }
  const total = (W - 2 * R) * (H - 2 * R);
  return { hotFrac: hotN / total, speckFrac: hotN ? speck / hotN : 0, coolFrac: coolN / total };
}
