# crucibleinnovation.com

Crucible (the studio) at `/` and Crucible Sites (the money page) at `/sites`.
Next.js 15 (App Router, static export) · TypeScript · Tailwind CSS v4 · GitHub Pages. `npm run build` writes the whole site as plain files to `out/`.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build (prints per-route JS sizes)
npm run typecheck
npm test           # Playwright smoke tests against out/ (build first)
npm run world:smoke   # the home page's world starts and draws (fast)
npm run world:preview # the home page as one self-contained file: world/dist/crucible.html
```

Pull requests run `.github/workflows/ci.yml`: typecheck, build, the Playwright tests (phone and desktop) and Lighthouse CI (`lighthouserc.json`). Accessibility, SEO and best practices must score ≥ 95, and performance below 90 shows as a warning.

## Before launch

Search the code for `TODO(jakob)`. The ones that matter:

| What | Where |
|---|---|
| Contact email (currently `jacob@crucibleinnovation.com`) | `data/site.ts` |
| FAQ answers | `data/faq.ts` |
| Client sites: fill in and uncomment each of the three slots once that site is live (see "Adding a client site") | `data/work.ts` |

## Editing content

Copy lives in `data/*.ts`, so most changes are one edit:

- **`ventures.ts`**: add a venture by adding one entry (name, blurb, tagline, description, mark). `status: 'forging'` shows "Coming soon" and its monolith still glowing at the base; any entry without `href` gets a page at `/ventures/[slug]`. Its object is a metal monolith rising out of the lava on the home page (`lib/world/ventures.ts`, `lib/world/glsl/monolith.glsl`); `public/film/monoliths/<name>-*.webp` are transparent stills of it from the same shader (`node scripts/monolith-stills.mjs`, set `monolith` in the entry), shown on `/ventures` and its own page (without them its mark glows in CSS), and `node scripts/venture-og.mjs` builds the pages' share images (`public/og/<slug>.jpg`) from them.
- **`work.ts`**: `clientSites` are the published client sites, shown first on `/work` and `/sites`; add each one once it's live (below). `work` are the concept sites; keep `label: 'Concept'` on anything that isn't a paying client. The `/sites` hero shows live HTML versions of the same three concepts, in `components/LiveSite.tsx`.
- **`pricing.ts`**, **`faq.ts`**, **`site.ts`** (name, founders, email).

### Adding a client site

Once a client's site is live and they're happy for it to be shown:

1. Screenshot it: `node scripts/shoot-client.mjs <slug> <url>` writes `public/work/<slug>.webp` (desktop) and `-phone.webp`.
2. In `data/work.ts`, fill in one of the slots in `clientSites` (name, type, one or two sentences, URL, `image: '/work/<slug>.webp'`) and uncomment it.
3. Check the site can be framed (most can; if `/work` shows it blank, set `embed: false` and the screenshot is shown instead).

It then appears first on `/work` (live, in a browser frame, with a link) and first in the `/sites` work grid, where it takes a concept's place. The copy about client work arriving "as it ships" switches over by itself.

The Split Ring's machine half can be squares or dots: `<SplitRing pixel="dot" />` (geometry is in `lib/splitRing.ts`).

## Showcase images

`public/showcase/*.webp` are screenshots of the hand-built concept pages in `showcase-src/` (fictional businesses, plus a deliberately dated "before" page). To change one, edit the HTML and re-render (needs Playwright with Chromium):

```bash
node showcase-src/render.mjs
```

It also writes 640px and 960px copies (`name-640.webp`, `name-960.webp`), which `lib/imageLoader.ts` serves to smaller screens because GitHub Pages can't resize images.

The mark is the Split Ring from Jacob's logo family, one geometry for every copy (`lib/splitRing.ts`, checked by `tests/mark.spec.ts`): two half circles that stop at the core's centre line, a one-step break, then 7 + 4 upright squares centred on the circles. Small sizes use the family's brand mark (one ring, four squares, the core): the favicon is its pixel-snapped 16 px master, which follows the browser's light or dark theme. The favicon (`public/favicon.svg`), `public/apple-icon.png` and the inline marks in `brand/og.html` and `brand/business-card.html` are written by `node --experimental-strip-types scripts/mark-assets.mjs`; after a change to the mark, run it, then `node brand/render-og.mjs` and `node brand/render-card.mjs`. The OpenGraph images are `app/opengraph-image.png` and `app/sites/opengraph-image.png`, rendered from `brand/og.html` with `node brand/render-og.mjs`.

## Design rules

`.claude/skills/unslop/SKILL.md` holds the design rules (what keeps the site from looking AI-made), and `npm run unslop` checks the ones a machine can.

## Fonts

Archivo is self-hosted as one variable file, `app/fonts/Archivo-latin-wght400-800-wdth100-125.woff2` (loaded in `app/layout.tsx`). To regenerate it from the full variable font: instance it with `fontTools.varLib.instancer` (`wght=400:800`, `wdth=100:125`), then subset with `pyftsubset` to Latin, Latin-1 punctuation and common accents, keeping `kern`, `liga` and `tnum`, output woff2. The concept sites' Instrument Serif is not preloaded; it is released after load + idle (`html[data-fonts]`) with a metric-matched fallback until then. Component CSS is imported by the component or page that uses it (not the layout); a class used on another route needs that CSS imported there too.

## Business card

`brand/business-card.pdf` is print-ready: two pages (front and back), 3.5 × 2 in trim with 0.125 in bleed on every side. The QR opens `https://crucibleinnovation.com/sites?ref=card`. Edit `brand/business-card.html`, then run `node brand/render-card.mjs`. It also writes `brand/business-card-front.png` and `-back.png`, which `/work` shows, so `/work` follows the card at the next build.

## This site on /work

`/work` shows this site as it is now: `public/work/crucible-site*.webp` are screenshots of the built home page. After visual changes to the home page, run `npm run build && node scripts/shoot-own.mjs`.

## Analytics and `?ref=`

The business card QR should point to `https://crucibleinnovation.com/sites?ref=card`. `components/RefTracker.tsx` keeps the `ref` for the visit and the quote form submits it as a `ref` field, so every lead from a card arrives tagged.

Traffic stats use **Umami** (cloud.umami.is). Add the site there, then add the repo variable `UMAMI_WEBSITE_ID` (the Website ID Umami shows) and re-run the deploy workflow. Until the variable exists no analytics script loads. Each visit from a card also logs a `Referral` event with `ref: card`.

## Quote form

By default the form writes the request as an email for the visitor: subject, body and all their answers, addressed to `site.founder.email`. Then it offers their mail app, Gmail, Outlook or "Copy message". On phones the mail app opens straight away. Nothing to set up and no monthly limit.

If you'd rather receive requests without the visitor sending an email, add a Formspree form ID as the repo variable `FORMSPREE_ID`. The form then posts in place and still falls back to the email route if Formspree fails.

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` builds the site and publishes `out/` on every push to `main`.

1. **One time:** Settings → Pages → Build and deployment → Source: **GitHub Actions**. Keep the custom domain `crucibleinnovation.com` and tick *Enforce HTTPS*.
2. Optional repo variables: `UMAMI_WEBSITE_ID` (analytics) and `FORMSPREE_ID` (in-page form posting). Re-run the workflow after adding them (Actions → Deploy to GitHub Pages → Run workflow).
3. For `www`, add a `CNAME` DNS record `www → jacobschppskis-hue.github.io`. GitHub Pages then redirects it to the apex.

The root `index.html` is the old "coming soon" page. It is only shown while Pages is still set to deploy from a branch, and can be deleted once the source is switched to GitHub Actions.

## Motion and performance notes

- **Scroll engine.** `lib/scroll.ts` runs one listener for every scroll effect. Each tracked element gets a `--p` CSS variable (0 → 1), and all reads happen before all writes on each frame. Mark an element with `data-scroll="view|enter|pin|reveal|read"` and style it with `var(--p)`, or call `trackScroll()` for a callback. Progress follows the scroll like a critically damped spring: a steady scroll plays at its own pace a few hundredths of a second behind, a jump plays as one smooth move and lands within about 0.57 s, with no speed cap and no snap at the end.
- **The home page is one world** (`lib/world/`, the contract and every hook in `lib/world/ARCHITECTURE.md`): a molten planet painted by one WebGL2 canvas behind the page, the camera on a journey round it as you scroll (the sunset hero with the mark hung round the sun, "stronger together", the founders' chapters over the night sea, PayPal's six sparks from orbit, the monoliths, the Thesis heating the sea, the sunrise over the limb at the footer), looping back to the hero with no visible jump. Every section is static HTML with its place (`data-place`); the world starts after load + idle or at first use, and without it the page is a designed still. `npm run world:smoke` checks it starts; `npm run world:preview` builds the single-file preview.
- **The liquid** (the other pages). The background of /sites, /work and /ventures is the same molten sea from straight above (`lib/liquid/`): a damped wave-equation grid on the main thread (`sim.ts`) plus an always-on idle swell (`swell.ts`). The pointer leaves a boat's wake at every speed (`wake.ts`: a Kelvin-like V built from its recent path), stronger while dragging; a finger leaves the same wake on phones, carried on through momentum after it lifts; scrolling past a resting cursor leaves one too. A tap is one clean drop. It is drawn with the home sea's model (`shader.ts`): a true blackbody glow under a thin skin, dark at rest so text stays readable, a little hotter in the swell's troughs and glowing Ember to amber along the visitor's waves, with crisp glints and no masks: waves pass under everything. It renders in a Web Worker on an OffscreenCanvas (main thread where that's missing) into one fixed `z-index:-1` canvas, starts at the first scroll, pointer move or key press (or 2.5 s after load + idle), adapts its own quality, and steps aside on the home page. `?liquid=full` pins full quality (screenshots).
- **One clock.** `lib/liquid/loop.ts` (`onFrame`) is the only animation loop and time, for the world too; workers draw exactly the time each main frame posts them. Test hooks: `window.__clock` (`pause`, `step`, `resume`, `settle`), `window.__world`, `window.__liquid` (`stats`, `sources`, `sample`), `window.__float.list()`.
- **Floating.** `lib/liquid/float.ts` makes text, headings and blocks ride the page liquid's waves (`data-fl`: grid and swell, never quite still) and links and buttons ride only the waves the visitor makes (`data-fl-c`), coming to an exact rest so clicks land. Levels via `data-float="strong|heading|block|text|none"`; nav, header, forms, dialogs and reduced motion are excluded.
- **Two tiers** (`lib/tier.ts`):
  - **Rich** is what every visitor gets: the world, the liquid and the WebGL effects (`lib/gl/*`). There's deliberately no low-bandwidth version. Rich effects load after the page's load and idle, so they never hold back the first paint. The footer's GL furnace waits until near the viewport (`whenNear()`), `BuildStage` sparks render in a worker, and the CRT portraits (`components/PortraitImg.tsx`) load lazily, eagerly after load + idle.
  - **Light** (CSS, SVG, the stills) is what's left with reduced motion, without JS, or when a scene can't start at all (no WebGL, a lost context).
  - On slow frames a scene lowers its own quality and keeps going.
  - Add `?tier=rich` or `?tier=light` to any URL to force a tier.
- **Footer** (the other pages): dark, with a furnace glowing under the wordmark (`Furnace`, `FurnaceGL`, `lib/gl/furnaceGL.ts`, a high-precision shader so Safari keeps its veins). It arrives composed: the wordmark doesn't slide in, and the CSS band is a still copy of the GL furnace, which fades in over it. The home page ends on its own shore (`components/world/Footer.tsx`) with the same links.
- **`/ventures`:** each venture is its metal monolith (a still from the home page's shader), standing on the liquid; hover lifts it. Every row and page keeps a plain text link.
- **`/sites`:**
  - `BuildStage` is the opening and the first scroll, built around live HTML versions of the concept sites (`LiveSite`): the café is cast, turned into a phone and recast as the barbershop and the landscaper. Rich tier: sparks (`lib/gl/sparks.ts`), from the first scroll or touch.
  - `TryIt`: the visitor types their business name and picks a trade; the live concept site is recast with it on a laptop and a phone. Nothing leaves the browser.
  - The before/after rests centred; the first time it is in view the divider sweeps to one side, then the other, and back to the centre. Then it can be dragged (or moved with the arrow keys).
  - `Process`: seven days you can scrub, while a site is made by hand from a blank page in the frame beside it.
- **`/work`:** on wide screens each group is a pinned stack, one site at a time (the next rises over the previous with a hot edge); a list on phones, short screens, reduced motion and without JS.
- **Everywhere:**
  - Primary buttons lean slightly toward the cursor, and the nav has a reading-progress hairline. The nav is opaque, with no backdrop blur (through any translucency a bright thing under it showed as a grey box), and fits 360 px phones. On phones the nav has a menu (a native dialog).
  - Selected text gets a light Ember tint and keeps its colour. Canvases, images and SVG can't be selected or dragged, and a mouse drag that starts on the liquid itself makes waves without selecting anything (`components/Liquid.tsx`); a sideways finger drag makes waves instead of swiping back in history (`overscroll-behavior-x`).
  - Moving between pages pours the next page in (`RouteTransition`).
- **Reduced motion and no JS.**
  - `prefers-reduced-motion` turns off loops, pinning, parallax, tilt, word reveals, page transitions, the liquid, floating, WebGL and smooth scrolling. Every scene shows its finished state and simple fades remain.
  - Without JS every scene also renders finished, the FAQ still works (native `<details>`), and the form opens a mail app.
  - Pinned scenes are also unpinned on very short screens (landscape phones).
- **Weight.**
  - First-load JS (gzipped, as `npm run build` prints it) is about 129 KB on `/sites` and 118 KB on `/` (budget: `/sites` well under 200 KB). The world, the liquid, floating and the WebGL modules load after the page is up. There is no animation library.
  - Below-the-fold sections on `/sites` use `content-visibility: auto`; their size estimates are measured content-box heights and each is rendered once after load.
