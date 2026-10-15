# crucibleinnovation.com

Crucible (the studio) at `/` and Crucible Sites (the money page) at `/sites`.
Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Vercel. Every route is prerendered as static HTML.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build (prints per-route JS sizes)
npm run typecheck
```

## Before launch

Search the code for `TODO(jakob)`. The ones that matter:

| What | Where |
|---|---|
| Formspree form ID: set `NEXT_PUBLIC_FORMSPREE_ID` in Vercel → Project → Environment Variables | `data/site.ts` |
| Contact email (currently `jacob@crucibleinnovation.com`) | `data/site.ts` |
| Spark / Forge / Alloy prices (`$TBD`) | `data/pricing.ts` |
| Budget bands in the quote form | `components/QuoteForm.tsx` |
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

The favicon (`public/favicon.svg`) and `public/apple-icon.png` are generated from the same Split Ring geometry. OpenGraph images are built at compile time by `app/opengraph-image.tsx` and `app/sites/opengraph-image.tsx`.

## Analytics and `?ref=`

Vercel Web Analytics is included (enable it in the Vercel dashboard). The business card QR should point to `https://crucibleinnovation.com/sites?ref=card`. `components/RefTracker.tsx` stores the `ref` for the session, sends a `Referral` custom event, and the quote form submits it as a `ref` field, so every lead from a card arrives tagged. (Custom events need a Vercel plan that includes them; the form field works regardless.)

## Deploy

1. Import the repo in Vercel (framework preset: Next.js, no settings to change).
2. Add `NEXT_PUBLIC_FORMSPREE_ID`.
3. Add both `crucibleinnovation.com` and `www.crucibleinnovation.com` under Domains. `next.config.ts` also 301-redirects `www` to the apex.

## Motion and performance notes

- Effects follow PRD §6. Reveals and the word blur-in are CSS driven by one shared `IntersectionObserver` (`components/InView.tsx`). The process line, Kelvin counter and before/after sweep use small helpers in `lib/motion.ts`. The PRD names Framer Motion; it was swapped for these helpers because it added ~22 KB gzipped and pushed `/sites` below the §8 Lighthouse bar. The visible behaviour is the same.
- `prefers-reduced-motion` turns off loops, the word reveal, tilt, the heat field drift, smooth scrolling and the before/after sweep. Simple fades stay.
- Without JS every section is visible, the FAQ works (native `<details>`) and the form posts straight to Formspree.
- The heat field canvas draws one static frame immediately and only starts drifting once the page is idle. It pauses off-screen and in background tabs.
- First-load JS: `/sites` ≈ 120 KB gzipped, `/` ≈ 110 KB.
