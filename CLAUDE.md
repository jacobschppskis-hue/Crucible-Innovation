# crucibleinnovation.com

Marketing site for Crucible (studio, `/`) and Crucible Sites (websites for local businesses, `/sites`, the page the business-card QR opens). Owner: Jacob Schopp. Read `README.md` for setup, deploy and the launch TODO list.

## Stack and commands
- Next.js 15 App Router, **static export** (`output: 'export'` → `out/`), TypeScript, Tailwind CSS v4. No server: no API routes, no `next/headers`, no runtime redirects, no image optimizer.
- `npm run dev` · `npm run build` · `npm run typecheck` · `npm test` (Playwright smoke tests against `out/`, so build first; locally set `PLAYWRIGHT_BROWSERS_PATH` if browsers live elsewhere).
- Deploy: push to `main` → `.github/workflows/deploy.yml` builds and publishes to GitHub Pages (custom domain via `CNAME`). PRs run `.github/workflows/ci.yml` (typecheck, build, Playwright, Lighthouse CI with `lighthouserc.json`).
- Repo variables (optional): `UMAMI_WEBSITE_ID` (analytics), `FORMSPREE_ID` (in-page form posting; without it the form composes an email via mail app/Gmail/Outlook).

## Where things live
- Copy and content: `data/*.ts` (`site.ts` founder/email/Formspree, `ventures.ts`, `work.ts`, `pricing.ts`, `faq.ts`). Prefer editing data over components.
- Pages: `app/page.tsx`, `app/sites/page.tsx`, `app/not-found.tsx`, `app/ventures/[slug]` (generated for live ventures without `href`).
- Brand: tokens and all effect CSS in `app/globals.css`; `components/SplitRing.tsx` (geometry in `lib/splitRing.ts`, shared with favicon), `components/Wordmark.tsx` (dotless ı + Ember dot).
- Motion: no animation library. Reveals = `[data-reveal]` / `[data-words]` + one IntersectionObserver (`components/InView.tsx`) + CSS. Scroll-linked effects use `lib/scroll.ts` (`data-scroll="view|enter|pin|reveal"` → CSS `var(--p)`, or `trackScroll()`); pinned scenes are `FusionStory` and `Thesis`. Brand sayings are placed individually where they fit (not collected in one spot). Jacob's story lives in `data/story.ts`, the team in `data/team.ts`. Everything must respect `prefers-reduced-motion` and stay readable with JS off (content is only hidden under the `.js` class).
- Images: showcase screenshots are rendered from `showcase-src/*.html` by `showcase-src/render.mjs`, which also writes the `-640`/`-960` variants that `lib/imageLoader.ts` serves. New images outside `/showcase/` are served as-is.
- Print: `brand/business-card.html` → `node brand/render-card.mjs` → `brand/business-card.pdf`.

## Rules (from the PRD)
- Never write "LLC", "incorporated", a street address, or any payment details (Venmo etc.). Payment copy: "No payment until you've approved the design."
- No fabricated testimonials, client logos, reviews or stats. Showcase items stay labeled `Concept` until they are real clients.
- Ember (`--ember`) is the only accent: about 3 Ember elements per screen at most. `--ember-hot` only inside gradients.
- Placeholders are marked `// TODO(jakob)`.
- Quality bar: Lighthouse mobile ≥ 95 on all four categories, `/sites` first-load JS well under 200 KB gzipped, no horizontal scroll at 360px, AA contrast, visible Ember focus rings.
- Gradient text (`.molten`) uses `background-clip: text`; keep its padding/negative-margin so italic descenders aren't clipped (a test checks this).
