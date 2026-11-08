# Continuum: notes

## The idea in three sentences
The page is one world seen by one camera: it opens on a molten sea at dusk, with the logo's core hanging over it as the
sun and the mark's rings around it, and as you scroll the camera tips down until it looks straight at the surface,
which becomes the dark liquid the rest of the site floats on. The sea cools as the camera leaves the sun, reheats from
below in the thesis, and the page ends where the camera reaches land: the same molten surf running up black sand under
the wordmark. The visitor's cursor (or finger) is a boat everywhere on it: one wake model from the horizon to the
shore, and the type itself warms, widening and gaining weight, when a wake passes under it.

## The mark
Jacob's logo family (Nov 2026, per the coordinator, `lib/splitRing.ts` at e480844): two rings (outer 20, inner 12, stroke
2.6 on a 48 grid), 7 + 4 upright squares (3.2) after a one-step break, Ember core (3.6). The hero's 3D mark, the castings'
relief and the no-WebGL SVG use it; the nav uses the brand mark (one ring, four squares) for its small size.
(Shots `02-beat` and `03-tilt` were removed: they showed the old mark; the rest of the frames are unaffected.)

## How Quench (the cool contrast colour) is used
Quench is `#8DB6F2`, a dusk steel blue, kept to cold things only (well under 5% of any screen):
- the cool band of afterglow in the hero sky between the warm horizon and the night, and the starlight;
- the cool fill on the top edges of the mark's pieces, and the cold sky reflected by wave faces turned away from the key;
- the CRT placeholders' glass (a cold screen with no signal yet);
- the thesis readout at room temperature (293 K reads Quench, and it heats through to Ember by 1811 K).
Everything hot stays Ember, so the warm/cold pair still means temperature and the Ember reads hotter next to it.

## What is real time
Everything you see behind the text is one fragment shader on one full-screen WebGL2 canvas (no library, no textures
except one generated at load: the ventures' names and the mark cut into their castings, drawn with Archivo in a 2D
canvas and uploaded as a height map):
- the camera (pitch and position) follows scroll; 1 world unit = 1 CSS px once it looks down, so the liquid is anchored
  to the content, and it stops while a scene is pinned;
- the sky (afterglow, a cool dusk band, a thin cloud deck lit from below, stars), the core as an HDR emitter, the mark
  as bevelled cast pieces backlit by it (their offsets come from the hero's story beats), and its reflection;
- the sea: an analytic swell (8 waves on the page, 3 more long ones on the horizon; anti-aliased by pixel footprint so
  the horizon never shimmers; unresolved slope becomes roughness, which is what turns the core's glint into a long
  glittering column), molten crust with glowing cracks whose temperature is a field: hottest under the sun, cooling with
  distance and with the tilt, reheated by the thesis, molten again at the shore;
- the wake: the pointer's recent path (two trails of up to 48 points: mouse or finger, plus a second finger) is sent as
  uniforms; each segment is a stretch of a boat's track, and a point beside it, passed `age` seconds ago, has the wake's
  arm at `r0 + c * age` with `c = v * tan(19.47 deg)`: Kelvin's angle at every speed, so a slow hover, a fast flick and
  a finger all leave a V of smooth lines, never rings or beads. Plus a trough along the track and faint transverse
  crests. The gradient is analytic (no finite differences); the same function runs in JS for the floating text and the
  heat type. Taps, the core's breathing ripples, PayPal's ring and the castings breaking the surface are analytic rings.
- the castings (ventures): a heightfield slab per venture, ray-intersected at its top height so it has real parallax and
  walls, rising out of the liquid as it scrolls in, with a meniscus and a ring when it breaks the surface; the live one
  is cast bone with the mark (its core still orange), the forging ones are dark crust with glowing cracks and the name
  cut through to the hot metal. Hover/focus/press lifts, heats the edge and turns the arrow Ember.
- the shore: the swash runs up the sand and drains back on its own clock, a bright lip at its edge, black sand with a
  few grains catching the glow, wet sand mirroring it.
- DOM: text blocks ride the liquid (translate/rotate from the same swell + wake slopes), display words heat with the
  wake and with reading (variable `wdth` and `wght`, bone -> Ember -> white-hot, then they settle), the CRT
  placeholders draw a no-signal test card at 24 fps only while on screen.

Performance: render scale steps (1.5x down to 0.35x of CSS px, DPR capped at 2), stepped down on slow frames; software
GL starts at the low step; the wake loop is skipped per trail by a bounding box; the canvas never resizes for a quality
step except to its new size; everything pauses in a hidden tab. Reduced motion: a still frame per scene (no swell
motion, no wakes, no floating, the hero's camera snaps from horizon to page). No JS: the copy is all in the HTML, the
nav and links work, the ground is the dark with a still horizon glow.

Test hooks: `?t=<seconds>` fixes the clock, `?q=<scale>` fixes the render scale, `?still` = reduced motion;
`window.__step(dt)` advances and renders exactly one frame, `__hold()` / `__resume()`, `__state()`, `__sample(x, y)`
(the CPU wave field under a screen point).

## How it was tested (Playwright Chromium, SwiftShader, clock held and stepped frame by frame)
- Hero idle: 9 frames over 6 s; the whole scroll walked at 1440x900 and on `devices['iPhone 15']` (17 positions each:
  headline, the three beats, mid-tilt, top-down, both chapters, PayPal, each venture, thesis at 293 K and 1811 K, shore).
- Cursor on the page liquid: slow straight (100 px/s), slow curve, medium (420 px/s), fast flick (2600 px/s), mouse drag;
  cursor over the hero's lava (380 px/s). Phone: CDP touch drag across the liquid, CDP touch scroll with momentum.
  Found and fixed along the way: beads on touch/scroll wakes (blend windows assumed equal segment lengths, and speed was
  re-derived per segment: now nearest segment only, smoothed speed per point, 35 ms low-pass on whole-pixel pointer
  input), aliasing of the crest light on phones (it was a sharp threshold, now proportional), the hero wake thinning to a
  dashed line on the far sea (wake scale now follows the foreshortened footprint).
- The CPU wave field (`__sample`) was probed across a slow hover: a clean V at about Kelvin's angle, continuous arms.
- No horizontal overflow at 360, 390, 768, 1440 (every element checked at every 700 px of scroll). JS off: all copy
  readable, no pins. Reduced motion: stills of the hero, story, ventures and shore.
- Not verified: real GPUs (no hardware here), so 60 fps on a MacBook and an iPhone is designed for (quality steps, DPR
  cap, skipped work) but not measured; Safari/WebKit not run.

## References (researched first)
- TDM, "Seascape" (Shadertoy Ms2SD1): the canonical procedural sea; sky + Fresnel reflection + sun specular on a
  heightfield. Takeaway: the sea's look is mostly the sky it reflects; keep the sky dark and the sea follows.
- Framer "Tidal Horizon" component: a WebGL sea where scroll moves the sun and the camera, cursor ripples. Takeaway:
  scroll as the camera is legible and calm when it's one continuous move, not cuts.
- Unseen Studio, "Diving Underwater" (Awwwards element): a scroll-driven camera that changes medium. Takeaway: the
  transition is the content; don't put text over the moment the world changes.
- The Kelvin wake pattern (scipython.com) and "Common principles behind rainbows and boat wakes" (arXiv 2508.05644):
  the wake as stationary interference with a fixed 19.47 deg half-angle; near the cusp it is an Airy profile. Takeaway:
  a cheap analytic model with the right angle and a short train of crests reads as a wake; rings from points never do.
- Real-time ship wakes in UE5 (Michell thin-ship / Stoker influence points, matheo.uliege.be 2268.2/25042). Takeaway:
  far-field wakes are fine as analytic patterns driven by the hull's path; no simulation needed.
- Sun glitter: the glint path is a wide microfacet lobe broken into sparkles; unresolved wave slope is added to the
  roughness (LEAN-style), which makes the column at a distance and keeps the horizon from aliasing.
- Today's crucibleinnovation.com footer furnace and the Thesis flames: the colour ramp (blackbody into Ember into
  white-hot) and the "molten surf" lip are kept from there.

## What I'd do next for production
- Split the shader into the site's pieces (`lib/liquid` keeps the page's band, a new `lib/gl3d/horizon` for the sky and
  sun), and move the per-pixel work to the existing worker path (`liquidWorker.ts`) so the main thread only posts the
  camera, the wake points and the rings each tick.
- Replace the slab heightfields with the real 3D ingots from `lib/gl3d` rising through the surface (the meniscus and
  rings from here), or keep these castings and give each forging venture its own mark (`// TODO(jakob)`).
- A real bloom pass (half-res, two taps) around the core and the surf lip; right now the glow is analytic.
- Swap the CRT placeholders for Jacob's CRT portraits.
- Tune on real hardware (an M-series MacBook and an iPhone): the quality steps were exercised only in software GL here.

## Questions for Jacob
1. The camera ends on the shore, so the footer is literally where the page lands. Do you want the surf to be bigger
   (more of the screen) or kept low under the wordmark as it is?
2. The hero keeps today's beats ("Not the person" / "Not the model" / "Neither, alone") on the mark around the sun
   before the camera tips down. Keep them, or go straight from the headline to the tilt?
3. Is the hero sky colourful enough for you ("some light colour in the sky"), or should the dusk band go further toward
   the teal/blue?
4. Should the hover wake be as quiet as it is (strong only while dragging), or louder by default?
