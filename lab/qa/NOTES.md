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

## iOS research: programmatic scroll during momentum, Lenis `infinite` + `syncTouch` (07:40 UTC)
Sources: WebKit source on GitHub (WKWebViewIOS.mm, ScrollingTreeScrollingNodeDelegateIOS.mm), commit 310169@main,
TanStack Virtual #1307/#1332/#1346, Lenis issues #26 #341 #454 #495 #496 #499 #535, Lenis 1.3.26 dist (lenis.mjs).
- **A JS scroll write during an iOS fling stops the fling dead (iOS 17, 18 and 26), for the root and for overflow
  scrollers.** Under a finger the write is ignored. iOS 27 no longer stops momentum, but a write can be overridden by
  the fling that is still running. Android Chrome (and our Playwright Chromium) keeps the fling going from the written
  position, **so a naive mid-fling wrap passes our tests and fails on an iPhone.**
- Writes are clamped to the content and stop the bounce, so a wrap exactly at the end snaps. The content past the
  seam must continue (the loop copy).
- `-webkit-overflow-scrolling` does nothing since iOS 13. `overscroll-behavior-y: none` kills the bounce but does not
  reliably block pull-to-refresh. Never set `overscroll-behavior: none` (both axes) on html/body: it kills back-swipe.
- **Lenis 1.3.26:** without `syncTouch`, touch scrolls natively and never loops. With it, a non-passive `touchmove`
  calls `preventDefault` and Lenis moves the page itself. Native momentum, bounce, pull-to-refresh and toolbar collapse
  are gone, and touch scrolling runs at the main thread's frame rate (where the world renders). The wrap is
  `modulo(animatedScroll, limit)` written with `scrollTo` every frame, which is fine because no native fling is running.
- **Lenis' release inertia is per frame:** `delta = sign * |velocity|^touchInertiaExponent`, where `velocity` is px moved
  in the last frame (L630/L833). Fling length depends on the frame rate: Low Power Mode (30 fps) goes ~3x further,
  120 Hz ~3x shorter. Native iOS decays by 0.998/ms, so a 3000 px/s flick glides ~1500 px over ~2.5 s.
- Lenis #496: iOS 26 broke vh units at the wrap with 100lvh panels. The maintainer recommends an element scroller.
  Our loop copy is `--world-vh = innerHeight` px, re-set on resize; toolbar changes are suppressed by syncTouch.
- igloo.inc: no teardown found. Its scene and text are all WebGL, so it is likely a virtual scroll.
- **What only a real phone shows:** the iOS write behaviour, fling catch (it fires no events), bounce and
  pull-to-refresh, toolbar/innerHeight changes, the 30/60 fps caps, main-thread lag, and the real fling feel.
- **Harness consequences:** `inertia` measures the glide at exactly 30, 60 and 120 Hz (held clock, one frame per touch
  event). `loop` flicks across the seam. Next: a write guard that patches `scrollTo` etc. and fails any write while a
  finger is down when the loop runs natively.
