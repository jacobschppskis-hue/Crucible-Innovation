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
| Formspree form ID: add a repo variable `FORMSPREE_ID` (Settings → Secrets and variables → Actions → Variables) | `data/site.ts` |
| Contact email (currently `jacob@crucibleinnovation.com`) | `data/site.ts` |
| Your photo (`founder.photo`) and 2–3 sentence bio | `data/site.ts`, `app/sites/page.tsx` |
| FAQ answers | `data/faq.ts` |
| Showcase: concept sites until real clients exist | `data/work.ts` |

## Editing content

Copy lives in `data/*.ts`, so most changes are one edit:

- **`ventures.ts`**: add a venture by adding one entry. `status: 'forging'` renders a dimmed card with no link. A `live` entry without `href` automatically gets a page at `/ventures/[slug]`.
- **`work.ts`**: showcase cards and the hero browser mockup. Keep `label: 'Concept'` on anything that isn't a paying client.
- **`pricing.ts`**, **`faq.ts`**, **`site.ts`** (name, founder, email).

The Split Ring's machine half can be squares or dots: `<SplitRing pixel="dot" />` (geometry is in `lib/splitRing.ts`).

## Showcase images

`public/showcase/*.webp` are screenshots of the hand-built concept pages in `showcase-src/` (fictional businesses, plus a deliberately dated "before" page). To change one, edit the HTML and re-render (needs Playwright with Chromium):

```bash
node showcase-src/render.mjs
```

It also writes 640px and 960px copies (`name-640.webp`, `name-960.webp`), which `lib/imageLoader.ts` serves to smaller screens because GitHub Pages can't resize images.

The favicon (`public/favicon.svg`) and `public/apple-icon.png` are generated from the same Split Ring geometry (`lib/splitRing.ts`). The OpenGraph images are `app/opengraph-image.png` and `app/sites/opengraph-image.png`.

## Business card

`brand/business-card.pdf` is print-ready: two pages (front and back), 3.5 × 2 in trim with 0.125 in bleed on every side. The QR opens `https://crucibleinnovation.com/sites?ref=card`. Edit `brand/business-card.html`, then run `node brand/render-card.mjs`.

## Analytics and `?ref=`

The business card QR should point to `https://crucibleinnovation.com/sites?ref=card`. `components/RefTracker.tsx` keeps the `ref` for the visit and the quote form submits it as a `ref` field, so every lead from a card arrives tagged.

For traffic stats, create a site at plausible.io and add a repo variable `PLAUSIBLE_DOMAIN` = `crucibleinnovation.com`. Plausible reports `?ref=card` as the visit's source automatically. Until the variable exists no analytics script is loaded.

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` builds the site and publishes `out/` on every push to `main`.

1. **One time:** Settings → Pages → Build and deployment → Source: **GitHub Actions**. Keep the custom domain `crucibleinnovation.com` and tick *Enforce HTTPS*.
2. Add the repo variables `FORMSPREE_ID` (and later `PLAUSIBLE_DOMAIN`), then re-run the workflow (Actions → Deploy to GitHub Pages → Run workflow).
3. For `www`, add a `CNAME` DNS record `www → jacobschppskis-hue.github.io`. GitHub Pages then redirects it to the apex.

The root `index.html` is the old "coming soon" page. It is only shown while Pages is still set to deploy from a branch, and can be deleted once the source is switched to GitHub Actions.

## Motion and performance notes

- Effects follow PRD §6. Reveals and the word blur-in are CSS driven by one shared `IntersectionObserver` (`components/InView.tsx`). The process line, Kelvin counter and before/after sweep use small helpers in `lib/motion.ts`. The PRD names Framer Motion; it was swapped for these helpers because it added ~22 KB gzipped and pushed `/sites` below the §8 Lighthouse bar. The visible behaviour is the same.
- `prefers-reduced-motion` turns off loops, the word reveal, tilt, the heat field drift, smooth scrolling and the before/after sweep. Simple fades stay.
- Without JS every section is visible, the FAQ works (native `<details>`) and the form posts straight to Formspree.
- The heat field canvas draws one static frame immediately and only starts drifting once the page is idle. It pauses off-screen and in background tabs.
- First-load JS: `/sites` ≈ 119 KB gzipped, `/` ≈ 110 KB.
