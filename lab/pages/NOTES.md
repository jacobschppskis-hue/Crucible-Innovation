# pages: audit and plan

Role: the rest of the site (/sites, /work, /ventures, /ventures/*, 404) in the new world's look, plus production
integration at the end (tests with `qa`, stills, build, Lighthouse, budgets, docs). Owns `components/{Nav,Footer,
MobileMenu}.tsx` and every component outside `components/world`, `app/{sites,work,ventures}/**`, `lib/liquid/*`,
`app/globals.css`, `CLAUDE.md`, `README.md`.

## Baseline (trunk f644d8a, 07:30 UTC)
- `npm run build`: OK. First-load JS (gzip): shared 103 KB, `/` 123 KB, `/sites` 129 KB, `/work` 111 KB, `/ventures`
  113 KB. Budget: `/sites` "well under 200 KB": keep it ≤ 150 KB, and keep `lib/world` out of the shared chunks.
- Tests: see "Test baseline" below.

## What the home page shares with the other pages today

| Piece | Where it is mounted | Used by | Risk when `app/page.tsx` becomes the world |
|---|---|---|---|
| `Liquid` (`lib/liquid/*`: fixed `canvas.liquid`, z -1, + text floating `float.ts`) | `app/layout.tsx`, every route | all pages | **Two full-screen canvases on `/`** (world + liquid), double GPU, and the liquid paints its dark over/under the world. It mounts once (`[]` deps) and survives client-side navigation, and a canvas given to its worker is spent, so it cannot just be restarted on the same node. |
| `SmoothScroll` (Lenis, wheel only) | layout | all pages | If `world` drives the home loop with Lenis (`infinite`), **two Lenis instances** fight on `/`. |
| `InView`, `ScrollDriver`, `ReadingHeat`, `Magnetic` | layout, re-run on `pathname` | all pages | Harmless on the new home if it uses no `data-reveal`/`data-scroll`; they are cheap DOM scans. `Magnetic` loads `lib/liquid/lean` for `.btn-primary`/`[data-pull]` and writes through `float.ts`: no floating on `/` means no lean either (fine). |
| `RouteTransition` (the poured sheet between pages) | layout | all | Works across any route; check it over the world canvas (sheet is opaque ground, z above everything). |
| `RefTracker` (`?ref=card` for the QR) | layout | /sites form | Must keep working: the business card QR opens `/sites?ref=card`. |
| `TIER_SCRIPT` (`lib/tier.ts`) | layout `<head>` | all | Has home-only bits for the old Ignition (`data-pour`, `data-go` at 3.5 s, `crucible:lit` quick intro). Dead once Ignition goes; remove then (one line). `richTier()`, `firstUse()`, `whenNear()` stay, the world should use them too (light tier must download no WebGL: a test checks it). |
| `Nav` (+ `MobileMenu`) | each page | all | Home variant links to `/#story`: needs the new home's section ids. The no-JS menu link goes to `#pages`, so **every footer needs `id="pages"`** (the new home footer is `story`'s). Nav is opaque `--ground`: keep (role rule), restyle only. |
| `Footer` (+ `Furnace`, `FurnaceGL`, `lib/gl/furnaceGL.ts`) | each page | all | Home gets `story`'s new shore footer (`components/world/Footer*`); the other pages keep `components/Footer.tsx`. Keep both in step (same links, email, `id="pages"`, founders line). |
| `Ventures.tsx` (`VentureObject`, `cueFor`, `hasIngot`) + `IngotScene` + `lib/gl3d/ingot*` + `Ventures.css` | home `Ventures` section | **/ventures and /ventures/[slug]** (`VentureObject`), /sites and /work (`.vf-link`) | When the home stops rendering `<Ventures />`, these must stay for the venture pages. Do not delete `Ventures.tsx`/`Ventures.css`/`IngotScene`/`lib/gl3d/ingot*` with the old home. |
| `SplitRing`, `Wordmark`, `Icons`, `Reveal`, `WordReveal`, `JsonLd` | everywhere | all | Keep. |
| `Builders`, `Crt.css`, `PortraitImg` | /sites (team) | /sites, old home story | `story` reuses the CRT placeholders on the home: they should import, not copy (shared `Crt.css`). |
| `globals.css` | layout | all | Holds home-only blocks (`.ig*` Ignition 492-925, story/scroll pins, Thesis 1114-1175, ventures track) and everything shared (tokens, buttons, nav, menu, reveals, FAQ, cast, route sheet, footer, furnace, 404). Strip the home-only blocks only after the new home is in and nothing references them. |
| Old home components | `app/page.tsx` only | home | `Ignition`, `Story`, `SplitPour`, `Thesis`, `HeatText`, `lib/gl3d/logo*`/`pour*`/`sceneWorker`, `lib/gl/molten.ts`, `lib/gl/splitPour.ts`/`splitTime.ts`: dead when the world lands. Remove at the end (after `story`/`paypal` confirm they ported what they need), so the build ships no dead chunks. |
| Tests | `tests/*.spec.ts` (qa owns) | | Home-specific (will break): most of `opening.spec.ts` (Ignition, pour, 3D logo, ingots on `/`, Thesis GL, story still), `smoke` "scroll scenes reach their finished state" (`/`), `unslop` "home: something responds to scroll" (`/`), `liquid.spec.ts` cases on `/` (liquid starts, idle swell, finger pan, reduced motion, menu). Page-independent ones that point at `/` should move to `/sites` (the liquid lives there now). Ingot canvas tests move to `/ventures`. |
| Lighthouse (`lighthouserc.json`) | CI | `/`, `/sites`, `/work`, `/ventures` | Perf is `warn ≥ 0.9` today; the brief wants ≥ 95 on all four for `/` and `/sites`. The world must start after load + idle or first use (like `Liquid`'s 2.5 s), compile its shaders off the main thread (worker) or in small tasks, and keep LCP = the headline text. |
| `scripts/shoot-own.mjs` (/work "This site" shots) | manual | /work | Waits for `section.ig[data-settled]`: rewrite for the world (wait for `__world.state()` ready, hold clock) and re-shoot at the end. |
| OG images (`app/opengraph-image.png`, venture `public/og`) | static | | Re-render the home OG from the world hero at the end (nice to have). Venture OGs come from ingot stills. |
| `CLAUDE.md` / `README.md` | | | Rewrite the home-page architecture sections at the end (world engine, journey, loop, modules, hooks). |

## Plan and contracts I need from others
1. **Liquid off on `/` (mine, now).** `Liquid` reads `usePathname()`; it runs only off the home page, and the canvas is
   re-keyed each time it (re)starts, so home → /sites by client-side navigation starts a fresh liquid and /sites → home
   stops it before the world mounts. Same for the text floating. Also `SmoothScroll` skips `/` if `world` takes the
   wheel there (ask `world`). Both behind one helper `isWorldRoute(pathname)` so the world can claim more later.
2. **Nav for the new home (mine).** Links to the new section ids (ask `world`: chapter/ventures/thesis ids). Look: the
   bar stays opaque ground (no translucency over the world), hairline, the brand mark, Ember CTA. Over a black sky the
   ground (#0d0d0b) bar reads as a band; option: make `--ground` the world's sky black so the bar is the sky. Decide
   with `look` once the sky colour is set.
3. **Footer (mine) in step with `story`'s home footer:** same content, `id="pages"`, the furnace look updated to the clean
   lava (no specks) once `lava` settles the palette.
4. **Lava look on the other pages (from ~11:00, with `lava`):** `lib/liquid/shader.ts` gets the clean molten look: a
   dark cooled skin at rest (the pages need AA text on it: dark ground stays dark), glow only where waves open it, no
   crust or specks. `lava` writes the shader; I keep the floating, budgets and tests green. Agree who edits
   `shader.ts` (proposal: `lava` edits it directly from 11:00, I don't touch it after that).
5. **Colours/tokens (mine, `globals.css`):** add `--quench` (#8DB6F2) for cold things; align `--ground` / `--bone` with
   `look`'s final values; nothing else changes on /sites (the QR page must stay exactly as legible).
6. **Venture pages:** keep content and layout. If `ventures` produces monolith stills (webp per venture from our own
   renderer), the venture pages show the monolith instead of the ingot, so the site has one metal; otherwise the ingots
   stay. Decide at ~11:30 with `ventures`.
7. **Production (13:30-14:30):** remove dead home code and CSS, `TIER_SCRIPT` cleanup, tests updated with `qa`, build,
   Lighthouse mobile on `/` and `/sites`, `/sites` JS budget, 360 px overflow, AA contrast, focus rings, re-shoot /work
   "This site", rewrite CLAUDE.md and README.md.

## From JACOB.md (read 07:50) for the other pages
- Q1: /sites, /work, /ventures "Match the new style": same content and layout, the new nav, footer, colours, lava liquid.
- Liquid: smooth glossy molten, never crust plates/specks/mottling (both concepts' seas are crust: don't copy them).
  Keep R3 behaviour: slight idle swell, boat-wake V lines at every cursor speed, drag more marked, smooth iPhone touch.
- Footer: he likes the glowing surf "waves breaking on a shoreline, except glowing" and the dark footer under the giant
  wordmark: keep the furnace, move it toward the clean lava palette; never the bone footer, never streak-line flames.
- Nav: opaque, never translucent (team rule after the grey-box bug). Brand mark + wordmark; no "Human × Machine" lockup.
- Venture pages: Verge/Trellis bars were "caked"/"out of place" (R3), and Q3 wants metal monoliths with no flaking. So the
  venture pages should show the `ventures` monoliths (live or stills from our renderer) once they exist.
- Quench was never ratified: keep it rare and strictly cold. Nothing on /sites turns Quench (no UI in Quench).
- Text floating on the other pages (R1 buoy behaviour) stays as it is: not addressed tonight (open Q12).

## Log
- 0c34e33/b0b2ea4: Liquid and SmoothScroll step aside on world pages (`[data-world], [data-world-root]`); verified the
  client-side handover / → /sites → Back → Forward on iPhone 15 + 1440 (fresh liquid each time, no errors).
- 6dc38fc: removed the old home's dead components and ~500 lines of CSS (globals.css 1443 → 941 lines).
- eee1874: `scripts/shoot-own.mjs` shoots the world's hero (`?world=full&motion`, `goPlace('hero')`, clock held).
  Verified it runs; re-shoot /work's images at the end when the hero is final.
- 9135946: Nav fits 360-375 px (the /sites CTA ran 9 px off a 360 px screen, also on the live site).
- Lighthouse on the world's first home (270b248): perf 69, TBT 11.6 s (world frames on the main thread under
  SwiftShader + 4x CPU). Sent the fix list to world (start on first use, worker, software-GL low start).
- Lava constraints for the pages' liquid sent (bg luminance ≤ 0.03 where text sits, CPU model in sync, cheap).

- (14:30) The other pages' liquid in the world's palette (`lib/liquid/shader.ts`): the sky it mirrors and the swell's
  sheen are the night over a molten sea (dark reds, not warm grey), and where the visitor's waves stretch the skin the
  molten body glows through (`LOOK.heat`, a blackbody ramp: deep red → Ember → yellow-white, thin lines along the
  wake, gone in ~3 s). At rest the background stays dark: relative luminance p99 0.0068, max 0.0073 on /sites at
  2600/5000/8000 px, iPhone 15 and 1440 (text hidden, canvas only), so --bone-dim text stays ≥ 6:1. Frames:
  `lab/pages/shots/sites-lava-*.webp`. liquid/sites-stage/process specs pass.
- (14:30) Bug: a sideways finger drag on /sites (making waves) made Chrome swipe back in history (to about:blank in the
  test). `html:not([data-world]) { overscroll-behavior-x: none }`; the home page keeps world's own setting.

- (14:20) /ventures and /ventures/[slug] show the monoliths (ventures' stills from the world's own shader,
  `public/film/monoliths/`, `data/ventures.ts` `monolith`), not the old ingots: one metal across the site. Hover/focus
  lifts the monolith 2.5%. The venture share images (`public/og/{verge,trellis}.jpg`) are rebuilt from them
  (`scripts/venture-og.mjs`). IngotScene and lib/gl3d ingot code are now unused by any page: remove in the cleanup.

- (14:40) The pages' liquid now uses lava's physical model (lava's notes 13:58): the body glows with a true Planck
  (600/550/460 nm, as look_planck) dimmed by Fresnel (F0 0.053) and a 30 K skin; 975 K at rest, +36 K in the swell's
  troughs (so the long waves read), +140 K (1 - exp) with the wake's stretch and +60 K on its crests (Ember to amber
  lines). Rest background p99 luminance 0.0084, max 0.0100 (bone-dim text ≥ 5.9:1). Lower than lava's suggested
  1000-1040 K: at 1000 K the page went muddy brown and the nav's ground read as a separate band.

- (14:25) Lighthouse mobile (local out/, cc8b9ea): /sites 96/100/100/100, /work 99/100/100/100, /ventures 98/100/100/100,
  /ventures/verge 99/100/100/100. `/` 58 (TBT 155 s, the world's frames on the main thread under SwiftShader): world's;
  a WorldMount diff (software GL starts only on first use) was sent to world 13:55.
- (14:25) Removed the ingots entirely (5bd4d63); CLAUDE.md and README rewritten for the new architecture (first pass;
  re-check at 19:00 against what world/look/lava/mark/paypal/ventures/story ship).

- (14:35) Full `npm test` on the trunk (qa's retargeted specs + the ingot removal): 96 passed, 6 skipped, 0 failed.

- (14:55) 07d32dd WorldMount: software GL starts the world only on first use (coordinator's go-ahead). Lighthouse mobile
  `/` 98-99/100/100/100 (TBT 42 ms). world:smoke ok. qa asked to make world.spec `start()` keep moving the mouse
  inside its poll (one move can land before hydration under load: flaky 1 in 3).

## Decisions
- (14:55) Software GL gets no idle start on the home page: Lighthouse and CI have no GPU, real visitors do; GPU-less
  visitors see the designed still until they touch or scroll, then the world.
- (08:40) Nav breakpoint 389 px: 390 px and up (iPhone 12-16) keep the current nav exactly.
- (07:40) Liquid is per-route: off on `/` (the world paints the home), on everywhere else. A restart gets a fresh
  canvas node (React key), never a second transfer of a spent one.

## Test baseline
- Full suite at f644d8a, 4 workers on this container: 120 passed, 5 skipped, 3 failed (desktop `liquid.spec` cursor
  wake / boat V / rest: timing under SwiftShader load). With 2 workers `liquid.spec` + `smoke.spec`: 37 passed, 5
  skipped (also with the per-route Liquid change). Run the GL-heavy specs with `--workers=2` here.

## Lighthouse baseline (lighthouse 12, mobile default, local serve of out/, f644d8a + per-route Liquid)
- `/`: perf 99, a11y 100, BP 100, SEO 100 (LCP 2.1 s, TBT 72 ms, CLS 0).
- `/sites`: perf 96, a11y 100, BP 100, SEO 100 (LCP 2.7 s, TBT 80 ms, CLS 0).
- Script: scratch `lh.sh <url> <name>` (lighthouse CLI + the Playwright Chromium).

## Dead code once the new home lands (import graph from every other route)
Reached only from the old `app/page.tsx`: `components/{HeatText,Ignition,SplitPour,Story,Thesis}.tsx`,
`components/Story.css`, `lib/gl/{molten,splitPour,splitTime}.ts`, `lib/gl3d/{adapt,logoRunner,logoScene,pour,pourGeo,
sceneWorker}.ts` (keep `data/story.ts`: the founders' text). Delete only those the new home doesn't import (re-run the
graph then), plus their CSS blocks in `globals.css` (`.ig*`, the scroll story, `.thesis*`) and the `data-pour`/`data-go`
part of `TIER_SCRIPT`. Already unreferenced today: `lib/imageLoader.ts` is the `next.config` loader (keep),
`lib/liquid/patch.ts` (worker-side sampler, keep).
