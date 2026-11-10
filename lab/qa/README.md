# QA harness

Everything runs in the Playwright Chromium that is already installed (`/opt/pw-browsers/...`, or set `PW_CHROMIUM_PATH`),
WebGL through SwiftShader. No extra installs: Playwright library + `sharp` (already in node_modules via Next).

## Before every push: `npm run world:smoke` (< 2 min)
```
npm run build && npm run world:smoke                 # the Next export in out/
npm run world:smoke -- --target=dist                 # world/dist/crucible.html (after npm run world:preview)
npm run world:smoke -- --target=frame                # the same inside the claude.ai artifact frame head
npm run world:smoke -- --target=http://localhost:3000   # the dev server
npm run world:smoke -- --only=iphone --shots         # one device, save frames to lab/qa/out/smoke/
```
Fails on: console/page errors, HTTP errors, no visible h1 within 4 s of DOMContentLoaded (the headline never waits on
WebGL), no `window.__world` within 15 s of load + first use, a white body (artifact frame), black or white frames at
p = 0 / .2 / .45 / .7 / .95, horizontal overflow (iPhone 15, 1440x900, 360 px), and `go(1)` != `go(0)` (the loop seam).

## The deep harness: `npm run qa:deep -- --target=out [--checks=...] [--devices=iphone,desktop] [--n=24]`
| check | what it proves |
|---|---|
| `walk` | held clock, `__world.go(p)` for p = 0..1 in n steps at iPhone 15 (390x844) and 1440x900; black / blown / Ember-flooded frames; the last frame equals the first. Contact sheets in `lab/qa/shots/<tag>/walk-*.webp` |
| `film` | constant-speed scroll through the whole loop, one frame per step; flags pops (a frame-to-frame change > 3.5x its neighbours), with before/after pairs |
| `loop` (+`keys`) | real input across the wrap: mouse wheel down past the bottom and up past the top, PageDown/Space, touch flicks with momentum (CDP `synthesizeScrollGesture`, fling on); no wrap = P0, progress going backwards or jumping = P1, momentum killed at the wrap = P1 |
| `touch` | a vertical finger drag scrolls the page; a horizontal drag neither scrolls sideways nor navigates back; a finger drag over the sea leaves a wake (`--seaP=<p>` or `state().seaP`); a tap clicks the first link; tap targets ≥ 44 px |
| `rm` | reduced motion: nothing moves at rest, the page simply ends (no loop), stills are not flat |
| `nojs` | every text block visible without JS, no white page, no overflow |
| `nowebgl` | Chromium with WebGL disabled: a designed still, no errors |
| `frame` | `world/dist/crucible.html` inside `plan/final/artifact-frame-head.html` (and inside a sandboxed iframe): not white, world starts, no errors |
| `overflow` | scrollWidth vs innerWidth down the whole page at 360, 393 and 1440 |
| `dead` | runs of > 0.3 viewport of scroll without text in view whose world frame is also flat |
| `contrast` | per text node: glyph boxes sampled on the rendered frame with the text hidden (same held frame), 10th-percentile contrast vs 4.5 (3 for large) |
| `perf` | SwiftShader ms/frame per `?q=` step at the device's real pixel count, scaled to an iPhone 15 GPU via a calibrated FMA shader (rough, ±2x) |
| `memory` | JS heap, DOM nodes, listeners, canvases after GC across three loops |

Report: `lab/qa/out/<tag>/report.md` (gitignored; frames next to it). Findings P0 (broken), P1 (visibly wrong), P2 (polish).

## Hooks the harness uses
`window.__world = { state(), go(p), hold(), resume?(), step(ms) }` (the contract), falling back to `__clock` and to the
concepts' `__state/__hold/__step`. Optional `state()` fields it reads: `progress` (0..1, the journey), `seaP` (a
progress where the camera is low over the sea, for the wake test).
