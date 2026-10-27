# Overnight progress

Read this first, every session. Newest notes at the bottom of each section.

- Branch: `overnight/award-build` (from `main` at 3579c9d). Never push to main, never merge.
- Scheduled task: `trig_018Qy59RkvbtFaG5654425W2` ("Overnight award build: crucibleinnovation.com"), cron `2 */2 * * *` UTC, fresh session per fire, notifications off. Disable it (update_trigger enabled=false) when `overnight/DONE` exists or after 10 sessions.
- Draft PR: https://github.com/jacobschppskis-hue/Crucible-Innovation/pull/11

## Sessions

| # | Started (UTC) | Heartbeat (UTC) | Ended (UTC) | Summary |
|---|---|---|---|---|
| 1 | 2026-10-27 01:01 | 2026-10-27 02:40 | | Setup: branch, PRD, PROGRESS, scheduled task. Then research + the "/" opening. |

## Plan

1. Setup (done in session 1).
2. Research award sites; record takeaways below. (done)
3. "/" opening animation + first scroll (priority 1). (first pass done: Ignition)
4. Tier detection (rich vs light) + rich-tier WebGL layer, loaded after first paint. (done: lib/tier.ts, lib/gl/ringParticles.ts)
5. "/sites" first scroll (priority 2).
6. Rest of both pages to the same craft level.
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

## Known issues

## What's next

- Tests for the new scene and tiers (tier override, reduced motion, no-JS finished states, rich-tier canvas mounts, WebGL fallback).
- Lighthouse locally (mobile) on / and /sites.
- Polish the opening: ring annotations, check 360x640, quick intro on repeat visits.
- Then the /sites first scroll (priority 2).
