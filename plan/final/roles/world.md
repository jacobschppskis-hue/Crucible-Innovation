# Role: world (lead)

You own the engine, the journey, the loop and the integration. Everyone else plugs into what you build, so the first
hour matters most: land a running skeleton and the module contract fast, then make the whole thing great.

## First hour (by ~08:00 UTC, push early, push often)
1. Read `plan/final/README.md`, `JACOB.md`, both concepts (Airless for the world/journey/planet, Continuum for the
   sunset hero, the camera tilt down to the page and the analytic wake). Research (≤30 min): igloo.inc (how its scroll
   loops seamlessly; Lenis is already a dependency here and has `infinite`, check how it behaves with touch/`syncTouch`
   on iOS), scroll-driven camera journeys (Awwwards SOTY sites), how to make an infinite native-feeling loop work on
   iOS Safari momentum scrolling. Write takeaways in `lab/world/NOTES.md`.
2. Skeleton on the trunk: `lib/world/` engine (WebGL2 canvas behind the page, the one clock, quality steps, a camera on
   a keyframed journey with placeholder places, the loop wrapping progress), `lib/world/modules.ts` registry, the new
   `app/page.tsx` (all sections as static HTML with data attributes for places; content from `data/*` and the founders'
   text verbatim), `components/world/WorldMount.tsx`, and `npm run world:preview` producing `world/dist/crucible.html`
   (single self-contained file that renders inside `plan/final/artifact-frame-head.html`).
3. `lib/world/ARCHITECTURE.md`: the exact module interface (GLSL function signatures each module implements and when
   the composer calls them, the per-frame state every module gets: camera, progress, place, time, sun direction,
   pointer/touch, quality), the journey's places table (who owns which section), the test hooks. Then message the
   coordinator: "contract ready, commit X".

## Then
- Design the journey with `look`: cosmic-scale orbit passes (the planet's limb, the sun, stars, the thin atmosphere as
  a line of light) alternating with low swoops over the smooth molten sea (where cursor/finger waves live). Continuous
  camera moves only. The hero = Continuum's sunset framing (low over the sea, horizon, the sun with the mark around it,
  sunset fading to stars); the end of the journey arrives back at exactly that frame, so the loop is invisible.
- The loop must be seamless on desktop wheel/trackpad, keyboard (PgDn/Space/End), and phones (touch with momentum,
  iOS Safari and Android Chrome). No jump, no flash, no momentum killed, no content skipped. The nav links still jump to
  their sections; screen readers and reduced motion get a normal page that simply ends. Prove it with tests (QA helps).
- Integrate modules as they land (yours to wire, theirs to own). Keep frame time in budget on phones (`?q` steps, render
  scale, prefer an OffscreenCanvas worker if it pays off; never resize the canvas for a quality step on WebKit).
- Keep `world/dist/crucible.html` building at every milestone; the coordinator publishes it.
