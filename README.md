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

- **Scroll engine.** `lib/scroll.ts` runs one listener for every scroll effect. Each tracked element gets a `--p` CSS variable (0 → 1), and all reads happen before all writes on each frame. Mark an element with `data-scroll="view|enter|pin|reveal"` and style it with `var(--p)`, or call `trackScroll()` for a callback.
- **Home page:**
  - The hero drifts away as you scroll.
  - `FusionStory` is a pinned scene in which the Split Ring assembles itself: arcs draw, pixels fly in, then the core ignites.
  - `Story` ("Where it started.") is Jacob's own account, kept in `data/story.ts`.
  - `Thesis` heats from 293 K to 1811 K as you scroll.
  - A giant wordmark rises into the footer.
- **`/sites`:**
  - The browser mockup tilts into place on load.
  - The before/after slider tilts up as it scrolls in, and its handle follows the pointer on a spring.
  - Heat runs along the process rail with a spark at its tip.
  - Showcase images drift inside their frames, and cards lean toward the cursor.
- **Everywhere:** primary buttons lean slightly toward the cursor, and the nav has a reading-progress hairline.
- **Reduced motion and no JS.** `prefers-reduced-motion` turns off loops, pinning, parallax, tilt, word reveals and smooth scrolling; every scene shows its finished state and simple fades remain. Without JS every scene also renders finished, the FAQ still works (native `<details>`), and the form opens a mail app.
- **Heat field.** The canvas draws one static frame immediately and only starts drifting once the page is idle. It pauses off-screen and in background tabs.
- **JS size.** First-load JS is about 122 KB gzipped on `/sites` and 113 KB on `/`. There is no animation library.
