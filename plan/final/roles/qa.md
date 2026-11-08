# Role: qa (the test harness and the continuous review)

You are the reason this works on a phone. Jacob: "It is imperative that this works on mobile. [...] It must be just as good
on mobile so I can show it to people."

## Deliver
- `npm run world:smoke` (fast, < 2 min: builds nothing, loads `out/` or the dev server, checks the world starts, no console
  errors, a few frames render non-black, no horizontal overflow) for everyone to run before pushing.
- A deep harness (`lab/qa/`): deterministic frame walks (clock held, `__world.go(p)` / scroll) at iPhone 15 and 1440×900
  through the whole journey and across the loop wrap (the last frame and the first must match); real touch via CDP (drag,
  flick-scroll with momentum, tap), wheel/trackpad and keyboard scrolling through the loop; reduced motion; no JS; no
  WebGL; the artifact frame (`plan/final/artifact-frame-head.html`) around `world/dist/crucible.html`; overflow at 360;
  dead zones (never > 0.3 viewport of scroll with nothing to read or look at); AA contrast of text over the world
  (sample the rendered pixels behind each text block); a perf proxy (SwiftShader frame ms per quality step, and a budget
  estimate for an iPhone GPU); memory (no leaks across 3 loops).
- Run it every ~30–45 min on the trunk and send the coordinator a short findings list (owner, severity, frame path).
- Research how real iOS Safari behaves with programmatic scroll during momentum and with Lenis `infinite` + `syncTouch`, so
  the loop is right on a real iPhone even though we can only emulate (Playwright here has Chromium only).
