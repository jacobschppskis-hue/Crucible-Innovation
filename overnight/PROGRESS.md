# Overnight progress

Read this first, every session. Newest notes at the bottom of each section.

- Branch: `overnight/award-build` (from `main` at 3579c9d). Never push to main, never merge.
- Scheduled task: `trig_018Qy59RkvbtFaG5654425W2` ("Overnight award build: crucibleinnovation.com"), cron `2 */2 * * *` UTC, fresh session per fire, notifications off. Disable it (update_trigger enabled=false) when `overnight/DONE` exists or after 10 sessions.
- Draft PR: https://github.com/jacobschppskis-hue/Crucible-Innovation/pull/11

## Sessions

| # | Started (UTC) | Heartbeat (UTC) | Ended (UTC) | Summary |
|---|---|---|---|---|
| 1 | 2026-10-27 01:01 | 2026-10-27 03:12 | | Setup: branch, PRD, PROGRESS, scheduled task. Then research + the "/" opening. |

## Plan

1. Setup (done in session 1).
2. Research award sites; record takeaways below. (done)
3. "/" opening animation + first scroll (priority 1). (done: components/Ignition.tsx)
4. Tier detection (rich vs light) + rich-tier WebGL layer, loaded after first paint. (done: lib/tier.ts, lib/gl/ringParticles.ts)
5. "/sites" first scroll (priority 2). (done: components/BuildStage.tsx + LiveSite.tsx, rich: lib/gl/sparks.ts)
6. Rest of both pages to the same craft level. (home done: Story reading heat, Ventures cast/forging, Thesis furnace + rich molten iron; /sites lower sections next)
7. Verify: Lighthouse mobile, 360px, reduced motion, no-JS, tests; recordings into the PR.
8. MORNING.md, disable scheduled task, DONE.

## Research: what we took from where

- **Vercel Ship 2024 (basement.studio):** SVG paints first, then a particle layer takes over once loaded. Used as-is: the SVG Split Ring is the first paint and LCP-safe, and the rich tier's particle ring crossfades in over it with a heat wave.
- **Lusion (Oryzo case study):** one continuous object instead of hero-then-page. The hero ring *is* the fusion scene's ring, with no cut between them. Also their restraint: premium pages tone motion down.
- **Apple product pages:** a pinned scene where the object only moves when you scroll, with copy changing under it ("Not the person / Not the model / Neither, alone").
- **Locomotive / GSAP SplitText `mask: lines`:** each headline line rises out of its own `overflow: clip` mask with an expo-out ease. Hand-rolled in CSS, no library.
- **Stripe / GitHub globes:** pause offscreen and in background tabs, antialias off, cap the DPR, and step quality down when frames run long (GitHub's tiers), then fall back to a static version.
- **Linear:** hairline borders, one moving highlight and real UI instead of illustration. To use on /sites.
- **Lando Norris / Igloo (SOTY 2024–25):** layered, pointer-reactive hero elements. Taken as the particle ring parting around the cursor ("stirring the metal").
- **Film-title convention (anamorphic flare):** one brief horizontal light streak at ignition, gone in about a second.
- **Device heuristics:**
  - WebKit reports `hardwareConcurrency` as only 4 or 8, and Safari has no Network Information API or `deviceMemory`.
  - So the confirmation step measures download speed from Resource Timing (`transferSize` / duration of our own files), requires a real WebGL context (`failIfMajorPerformanceCaveat`, no SwiftShader/llvmpipe) and runs a ~24-frame probe. Safari in Low Power Mode caps rAF at 30 fps, which fails the probe, so it goes light.
  - `prefers-reduced-data` ships nowhere yet, but it is checked anyway.

## Decisions to review

- The session harness asked for branch `claude/eloquent-ride-3pjb5m`, but Jacob explicitly asked for `overnight/award-build` and gave permission to push there, so all work is on `overnight/award-build`.
- Scheduled-task overlap rule: a session that runs longer than 100 minutes would otherwise look "stale" to the next fire, so each session refreshes a Heartbeat column on every push, and the next session stops if a session without an end has a start *or heartbeat* under 100 minutes old.

- The /sites hero's screenshot frame (BrowserFrame) is replaced by live HTML versions of the three concept sites (components/LiveSite.tsx). The screenshots are still used by Before/After and the Work cards. The live versions use the site's own fonts (Archivo, Instrument Serif) instead of the concept pages' Fraunces/Anton/DM fonts, so nothing extra downloads. The barbershop headline is Archivo 800 rather than Anton.
- New copy, all on /sites stage captions (no new claims, just the existing promises reworded):
  - "Built for the phone in their pocket." / "Mobile-first. Every layout is drawn for the phone first, then opened up for the big screen."
  - "Not a template." / "Same week, different business. Every concept here began as a blank page, not a template."
  - "Then it’s yours." / "Your domain, your content, live in about a week. No payment until you’ve approved the design."
- The home hero's second button still says "Our ventures". Forging ventures show an *unlit* core, so only the live venture gets Ember (this also keeps the Ember count down).
- Recordings (GIF + MP4, ~14 MB) are committed in overnight/media/ so the PR can show them. They are not part of the site build. Delete the folder after merging if you don't want them in the repo.
- `prefers-reduced-motion`, no JS and short landscape screens (< 540–560px tall) get unpinned, finished layouts.
- Rich tier on phones: allowed when the phone passes the checks (e.g. recent iPhones). Particle counts and DPR are lower on touch devices.

## Known issues

- Headless Chrome has no GPU, so rich-tier visuals were verified with SwiftShader (slow but correct). Real-device frame rates are not measured here; each WebGL scene steps down on long frames and hands back to light if needed.
- Lighthouse numbers vary run to run locally (home 95–96, /sites 91–96 performance). CI is the source of truth.

## Status (session 1, 02:30 UTC)

Done and pushed:
- **"/":**
  - Ignition opening and scroll story, with the particle ring in the rich tier.
  - Story reading heat.
  - Ventures cast/forging.
  - Thesis furnace, with molten iron in the rich tier.
- **"/sites":**
  - Live concept site cast on load.
  - Phone morph and recasts on scroll.
  - Sparks in the rich tier.
- **Tooling:** overnight/tools/capture.mjs, probe.mjs, shot.mjs, record.mjs (see headers).
- **Tests:** 50+ Playwright tests, all green locally. CI green through a1ff430's parent.

## What's next

1. /sites lower sections:
   - Builders portraits cast in behind the heat front.
   - Work cards (maybe live previews or a hover cast).
   - Process / pricing polish.
2. A page transition between / and /sites (heat wipe), if it can stay light.
3. A critical pass over both openings at 390 and 1440. Check the rich-tier handoff timing.
4. Lighthouse on CI. Refresh the PR recordings (`node overnight/tools/record.mjs ...`) and description.
5. MORNING.md, disable the scheduled task, DONE.
