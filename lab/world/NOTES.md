# world (lead): notes and decisions

## Decisions (07:10-08:00)
- **Engine on the main thread**, one WebGL2 canvas, composed shader (module GLSL chunks + engine dispatch). A worker
  would force every module's uniforms/textures through postMessage; the cost is GPU-side, not JS. Revisit only if a
  phone profile shows main-thread jank.
- **Planet R = 6000** (1 unit ~ 1 m low over the sea): the horizon dip at h 1.6 is ~1.3 deg, so the planet reads huge
  when low and still fits in frame from h ~3000 (orbit). Float precision of surface coords ~0.002 units.
- **One lap = one day**: the sun is fixed in the world (sunLon -87 deg). The hero is on the evening terminator looking
  back west into the sunset (yaw 180); the camera turns to the night, climbs to orbit (PayPal), comes down to skim the
  sea (ventures, waves), climbs (thesis), meets the sunrise from orbit and crosses the day side fast and high, landing
  on the evening terminator = the hero. Seamless because the camera depends only on theta (mod 2 PI) and every key at
  the end equals the first key one lap on.
- **The loop = Lenis infinite + syncTouch** (Lenis is already a dependency). Native momentum on iOS/Android dies when
  a script sets the scroll mid-fling, so a native "jump back" cannot be seamless on phones; Lenis carries touch
  inertia itself and wraps modulo its limit. The last place is the hero's first screen again (inert, aria-hidden),
  exactly innerHeight tall, so limit = its top. Keys handled by loop.ts so they wrap too. Reduced motion / no JS /
  ?loop=0: no loop, the copy is display:none, the page simply ends.
- **React renders static markup only** on the home page; behaviour lives in lib/world modules, so the single-file
  preview behaves like the site.
- The page liquid (lib/liquid) and the site Lenis (SmoothScroll) step aside while the world is mounted
  (`crucible:world` event, `[data-world-root]`): small edits in pages' Liquid.tsx / SmoothScroll.tsx, told to pages.

## Research takeaways (timeboxed)
- igloo.inc: the page is a fixed WebGL scene driven by a virtual scroll value that wraps; content is projected/
  overlaid. Their loop is seamless because the end state equals the start state, not because of a DOM trick.
- Lenis `infinite`: `scroll = modulo(animatedScroll, limit)`; touch needs `syncTouch: true` (Lenis eats touchmove and
  applies its own inertia: feels slightly different from native on iOS, but keeps momentum across the seam).
  Programmatic `scrollTo` re-bases animatedScroll to the wrapped value and takes the nearest copy of the target.
- Scale (for look): low camera + wide horizon + tiny far detail + aerial perspective + one huge object against it
  (Dune: human figures tiny against forms, long lenses compress, haze layers depth). Our journey alternates a 1.6 m
  camera with a 3000 m orbit; log-space altitude interpolation keeps the zoom even.

## 13:40-14:00 (after a worker restart lost ~6 h)
- The mark is in: `lib/world/markModule.ts` (world integrates mark's markTrace/markFrame) hangs the whole Split Ring
  around the sun at every distance (scale = sun.R / 4.8, facing the camera, upright to the planet), drawn in `over`,
  depth-tested; the stronger-together beat runs on the `together` pin, its three captions (together.ts LINES) are
  set from it: the two halves stacked low over the sea, then "Stronger together" in their place.
- PayPal's own camera (`paypalKeys`) is spliced in via the registry (`{ ...paypal, keys: paypalKeys }`).
- Lighthouse: the world starts 2.5 s after load + idle or on first use; software GL starts at the lowest step and
  draws at ~12 fps (never while a harness holds the clock). The worker (OffscreenCanvas) path was NOT done: open item.
- Story/thesis horizons lowered so type sits over sky; `state().seaP` added.
- Verified: `npm run world:smoke` ok (seam iPhone Δ 5.6 vs in-page 8.6, desktop 3.2 vs 3.9); frames
  `lab/world/shots/v5-{phone,desk}.webp`.
- Open: the mark is not reflected in the sea (over hook only; an `env`/`hit` integration would give the reflection);
  the shore shot puts the rising far sun + mark behind the footer links on phones; worker rendering for TBT.
