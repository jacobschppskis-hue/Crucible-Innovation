# QA notes

## Harness decisions
- **Chromium only, SwiftShader GL.** The container's Chromium (`/opt/pw-browsers/chromium-1243`) runs WebGL2 through
  SwiftShader on 4 CPU cores. A full-resolution world frame can take 100+ ms, and **input is frame-gated**: touch moves
  and wheel ticks are handled once per produced frame. So input tests (loop, touch) can run the world at a cheap step
  (`--inputQuery=q=5`), and two harness runs must never share the machine (they starve each other: false "no wrap"
  findings).
- **Touch with momentum.** `Input.synthesizeScrollGesture` does not scroll in this headless build. CDP
  `Input.dispatchTouchEvent` with tight explicit `timestamp`s (8 ms apart) gives Chromium's gesture detector a release
  velocity, and it flings: a 400 px stroke carries the page ~2900 px over ~2 s with deceleration (`flick()` in `lib.mjs`).
  That is Chrome-for-Android physics. iOS deceleration is longer and softer (see the research below), and only a real
  phone can show how it feels.
- **Deterministic frames.** We hold the clock and render exact frames with `__world.step(ms)`. A world that only renders
  while the clock runs breaks the walks; the contract asks for `step()` to render one frame.
- **Contrast.** We take the same held frame twice, once as it is and once with every glyph transparent, and sample the
  background inside each text node's client rects. We report the 10th-percentile contrast, so a few bright glints under
  a word don't fail it but a band of bright lava under it does. Text opacity (the product of ancestor opacities) is
  blended in sRGB the way the browser does it.
- **Perf proxy.** A calibrated FMA shader measures SwiftShader's GFLOPS on this box. The world's ms/frame at the
  device's real pixel count (dpr 3 on iPhone) is then scaled by A16 peak (~1.79 TFLOPS) / that rate. This is ±2x at
  best: real phones also pay bandwidth, tile memory and thermal limits. It ranks the quality steps; it does not certify
  60 fps.

## iOS research
(see below, filled from the research pass)
