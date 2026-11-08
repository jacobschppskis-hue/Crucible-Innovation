# Role: pages (the rest of the site + production)

## Deliver
- Shared chrome in the new style: `components/Nav.tsx` (opaque ground, never translucent), mobile menu, the footer for the
  other pages. Keep every page's content and layout; give /sites, /work, /ventures/* the new world's look (colours, type,
  the lava liquid from `lava` in `lib/liquid/shader.ts`, from ~11:00 when the look settles).
- Production integration as the home page lands: Playwright tests updated for the new home (with `qa`), the still
  version for reduced motion / no JS / no WebGL, `npm run build` static export, Lighthouse ≥ 95 mobile on all four
  categories for / and /sites (lighthouserc.json), /sites first-load JS well under 200 KB gz, no horizontal scroll at 360,
  AA contrast, Ember focus rings, CLAUDE.md and README.md rewritten for the new architecture.
- Start now: audit what the home page currently uses that the other pages also use (Liquid, Nav, Footer, Furnace, InView,
  loop.ts…) so nothing breaks when `app/page.tsx` changes; plan the changes in `lab/pages/NOTES.md`.
