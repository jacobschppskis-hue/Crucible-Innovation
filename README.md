# crucibleinnovation.com

Crucible (the studio) at `/` and Crucible Sites (the money page) at `/sites`.
Next.js 15 (App Router, static export) · TypeScript · Tailwind CSS v4 · GitHub Pages. `npm run build` writes the whole site as plain files to `out/`.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build (prints per-route JS sizes)
npm run typecheck
npm test           # Playwright smoke tests against out/ (build first)
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

- **`ventures.ts`**: add a venture by adding one entry (name, blurb, tagline, description, mark). `status: 'forging'` shows its bar still glowing, with "Coming soon"; any entry without `href` gets a page at `/ventures/[slug]`. Its ingot is a real-time 3D cast bar (`lib/gl3d/ingots.ts`); `public/film/ingots/<slug>-*.webp` are its transparent fallback stills (`node scripts/ingot-stills.mjs`; without them its mark glows in CSS), and `node scripts/venture-og.mjs` builds the pages' share images (`public/og/<slug>.jpg`) from them.
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

The mark is the lattice ring, one geometry for every copy (`lib/splitRing.ts`, checked by `tests/mark.spec.ts`). The favicon (`public/favicon.svg`), `public/apple-icon.png` and the inline marks in `brand/og.html` and `brand/business-card.html` are written by `node --experimental-strip-types scripts/mark-assets.mjs`; after a change to the mark, run it, then `node brand/render-og.mjs` and `node brand/render-card.mjs`. The OpenGraph images are `app/opengraph-image.png` and `app/sites/opengraph-image.png`, rendered from `brand/og.html` with `node brand/render-og.mjs`.

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

- **Scroll engine.** `lib/scroll.ts` runs one listener for every scroll effect. Each tracked element gets a `--p` CSS variable (0 → 1), and all reads happen before all writes on each frame. Mark an element with `data-scroll="view|enter|pin|reveal|read"` and style it with `var(--p)`, or call `trackScroll()` for a callback.
- **The liquid.** The site background is a dark liquid (`lib/liquid/`): a damped wave-equation grid on the main thread (`sim.ts`) plus an always-on idle swell (`swell.ts`). A moving pointer is one vibrating source that rings in step with the animation clock, so its crests stay right at the cursor; above about 1.6 times the wave speed it hands over to drops along the path (a smooth V behind a fast flick). A tap is one bigger drop, and finger drags and scrolling past a resting cursor leave a wake. It is drawn as a shaded glossy surface (dark reflection, a key light shaped like a strip so glints streak along crests, Ember glints only where something just happened and only where the surface curves, capped behind text so it stays AA), with no lines, in a Web Worker on an OffscreenCanvas (main thread where that's missing) into one fixed `z-index:-1` canvas, so section backgrounds are transparent. It starts at the visitor's first scroll, pointer move or key press, or 2.5 s after load + idle. It adapts its own quality, and software GL (no GPU: CI, PageSpeed) starts low. `?liquid=full` pins full quality (screenshots).
- **One clock.** `lib/liquid/loop.ts` (`onFrame`) is the only animation loop and time; workers draw exactly the time each main frame posts them. Test hooks: `window.__clock` (`pause`, `step`, `resume`, `settle`), `window.__liquid` (`stats`, `sources`, `sample`), `window.__float.list()` and `window.__logo` (the logo pieces' poses). The ingot worker reports a frame as drawn only once the GPU has finished it, so a slow GPU paces the frames instead of queueing them.
- **Floating.** `lib/liquid/float.ts` makes text, headings and blocks ride the waves (`data-fl`: grid and swell, never quite still) and links and buttons ride only the waves the visitor makes (`data-fl-c`), coming to an exact rest so clicks land. Levels via `data-float="strong|heading|block|text|none"`; nav, header, forms, dialogs and reduced motion are excluded. The logo pieces and the ingots float inside their 3D scenes on the same surface (`footprint()`/`samplePx()` in `field.ts`, `buoy3()` in `lib/liquid/buoy.ts`): their poses are computed on the main thread every frame and posted to the worker that draws them. The logo feels the idle swell at a quarter of its height, so the lattice stays readable at rest.
- **3D** (`lib/gl3d/`): a small WebGL2 renderer with procedural metal materials (no assets, no Blender). The home logo (`logoScene.ts`, `pour.ts`) and the venture ingots (`IngotScene`, `ingotScene.ts`) are real-time objects in their own canvases, created near the viewport and released when far. Both run in Web Workers (`sceneWorker.ts`, `ingotWorker.ts`) and the headline shows from first paint. The pour has no mould: the metal fills a faint drawing of the mark's own outline (`.ig-ghost`, timed from the same clock as the pour, gone before the metal sets), cools to bone and floats; it sets `section.ig[data-settled]` when it ends, and `?pourdebug` makes the pour contact sheet. Each ingot is a cast bar (`goldBar()`), lying on the liquid tilted toward you, turning as it passes; Crucible Sites is cast bone metal (it reflects a dim foundry: warm lines along its edges, fine sand grain, no Ember tint) stamped with the lattice ring and its name, the bars still forging glow and carry their name alone (`// TODO(jakob)`: their own marks). Static versions: the SVG logo and the transparent ingot stills (`node scripts/ingot-stills.mjs`). Software GL drops MSAA and bump taps and starts at the lowest quality step (`?liquid=full` and the stills keep full fidelity).
- **Two tiers** (`lib/tier.ts`):
  - **Rich** is what every visitor gets: the liquid, the 3D scenes and the WebGL effects (`lib/gl/*`). There's deliberately no low-bandwidth version. Rich effects load after the page's load and idle, so they never hold back the first paint. The Thesis and footer GL contexts wait until near the viewport (`whenNear()`), `BuildStage` sparks render in a worker, and the ASCII portraits (`components/PortraitImg.tsx`) load lazily, eagerly after load + idle.
  - **Light** (CSS, SVG, the stills) is what's left with reduced motion, without JS, or when a scene can't start at all (no WebGL, a lost context).
  - On slow frames a scene lowers its own quality and keeps going.
  - Add `?tier=rich` or `?tier=light` to any URL to force a tier.
- **Home page:** one continuous casting, top to bottom.
  - `Ignition` is the opening and the first scroll: white-hot metal is poured into the 3D logo's own outline, then "Not the person / Not the model / Neither, alone" on the same ring. On phones the first line rolls in as the headline leaves and each line rolls into the next, with the ring moved to the middle of the space between the nav and the lines.
  - `Story`: one chapter per co-founder (Jacob first, `data/story.ts`), the bone ASCII portrait (`public/team/*-bone.webp`, made luminance-correct from the ink originals by `python3 scripts/bone-portraits.py`) pinned while the text warms as it's read. One moment from Jacob's account is shown, not told: one pour into PayPal feeding six castings, the six companies.
  - `Ventures` is the foundry floor: a pinned sideways track (vertical on phones) of 3D cast bars floating on the liquid (stills from `public/film/ingots/` as the fallback).
  - `Thesis` heats from 293 K to 1811 K as you scroll, with WebGL flames (`lib/gl/molten.ts`) over the liquid: crisp tapered tongues along the bottom 30% of the scene at full resolution, nothing below about 800 K and at most about a sixth of the screen tall at 1811 K. They rise at one constant speed and only grow wider, taller and brighter with the heat; a static CSS furnace holds the heat until the flames fade in. GL fades run on the animation clock (`--gl`), never on CSS transitions.
  - The footer is dark, with a furnace glowing under the wordmark (`Furnace`, `FurnaceGL`, `lib/gl/furnaceGL.ts`, a high-precision shader so Safari keeps its veins). It arrives composed: the wordmark doesn't slide in, and the CSS band is a still copy of the GL furnace, which fades in over it.
- **`/sites`:**
  - `BuildStage` is the opening and the first scroll, built around live HTML versions of the concept sites (`LiveSite`): the café is cast, turned into a phone and recast as the barbershop and the landscaper. Rich tier: sparks (`lib/gl/sparks.ts`), from the first scroll or touch.
  - `TryIt`: the visitor types their business name and picks a trade; the live concept site is recast with it on a laptop and a phone. Nothing leaves the browser.
  - The before/after rests centred; the first time it is in view the divider sweeps to one side, then the other, and back to the centre. Then it can be dragged (or moved with the arrow keys).
  - `Process`: seven days you can scrub, while a site is made by hand from a blank page in the frame beside it.
- **`/work`:** on wide screens each group is a pinned stack, one site at a time (the next rises over the previous with a hot edge); a list on phones, short screens, reduced motion and without JS.
- **Stills.** `film/ingots.py` is the old Blender reference (the original plaques); the shipped ingot stills come from our own 3D renderer (`film/README.md`).
- **Everywhere:**
  - Primary buttons lean slightly toward the cursor, and the nav has a reading-progress hairline. The nav is opaque, with no backdrop blur (through any translucency the bright 3D under it showed as a grey box). On phones the nav has a menu (a native dialog).
  - Selected text gets a light Ember tint and keeps its colour. Canvases, images and SVG can't be selected or dragged, and a mouse drag that starts on the liquid itself makes waves without selecting anything (`components/Liquid.tsx`).
  - Moving between pages pours the next page in (`RouteTransition`).
- **Reduced motion and no JS.**
  - `prefers-reduced-motion` turns off loops, pinning, parallax, tilt, word reveals, page transitions, the liquid, floating, WebGL and smooth scrolling. Every scene shows its finished state and simple fades remain.
  - Without JS every scene also renders finished, the FAQ still works (native `<details>`), and the form opens a mail app.
  - Pinned scenes are also unpinned on very short screens (landscape phones).
- **Weight.**
  - First-load JS is about 170 KB gzipped on `/sites` and 161 KB on `/` (budget: `/sites` ≤ 172 KB). The liquid, floating, 3D and WebGL modules load after the page is up. There is no animation library.
  - Below-the-fold sections on `/sites` use `content-visibility: auto`; their size estimates are measured content-box heights and each is rendered once after load.
