# mark: notes

## Stronger together: three storyboards (07:35 UTC)
Constraints: the mark is never moved apart, scattered, spun or flown; the beat is scroll-scrubbed (pure function of
progress, so reversible); it reads in about 2 s on a 390x844 phone; it uses the site's own language (light, heat, casting
fronts, cooling to bone, the sea). Copy uses Jacob's words where possible ("The human half and the machine half." is his
sentence in data/story.ts). Scroll lengths are in viewport heights (vh) after the hero headline.

### A. Closing the ring (recommended)
The idea: each half on its own is half a circle. One heat front runs round both halves at once, each in its own way: down
the arcs as one continuous line, down the squares one square at a time. Only when both arrive at the bottom is the circle
whole, and then the ring of light is complete.
1. (0 vh) Hero as is: the core is the sun over the sunset sea, the whole mark hangs round it in cast bone, its
   reflection on the sea. "Intelligence, alloyed".
2. (0.2 vh) The camera drifts a little lower and to the sun's axis, so the mark is backlit: its faces sink to dark cast
   metal against the bright sky (a silhouette, nothing moves). The headline leaves (rolls up into its mask).
3. (0.35 vh) A thin Ember front (the site's "casting" front: white-hot edge, glow behind it that cools back to bone) starts
   at the top, where the arcs end on the core's centre line. On the left it slides down both arcs continuously. On the
   right the same front steps: each square lights whole, in turn, as the front passes its angle (7 outer, 4 inner, so
   the inner ring's steps are slower and bigger). Caption, one line under the mark: "The human half." (left-aligned under
   the arc) then "The machine half." (right-aligned under the squares), both visible together by 0.6 vh.
4. (0.75 vh) Both fronts reach the bottom at the same instant. For a moment the full circle is lit, the core flares
   (the sun brightens, its glitter column on the sea flares too) and the sea's reflection shows a complete ring of light.
   The two captions give way to one display line: "Stronger together".
5. (0.9-1.1 vh) The glow cools to bone from the top down, both halves together (one material now), leaving only a warm
   rim on the faces turned to the core. The camera resumes the journey.
Reverse scroll runs it backwards exactly. Reduced motion: the still of frame 4. Risk: low (it is lighting on a rigid
mark; the front is an angle uniform, the squares quantise it). Cost: none beyond the mark shader.

### B. One fire, both halves
The idea: the same heat reaches both halves at once; it is the core (the orange, Jacob's "meeting at an orange core")
that makes them one.
1. (0 vh) Hero.
2. (0.2 vh) The sun sinks to the horizon line and dims (dusk deepens, stars come up); the mark goes to silhouette.
   Caption: "The human half and the machine half."
3. (0.4 vh) The core reignites. Its light spreads outward as one sphere of heat: the inner ring (arc and squares at the
   same radius) catches it at the same instant, then the outer ring, arc and squares again together. Warm rims, then
   full bone faces; the sea's reflection fills in with it.
4. (0.7 vh) "One fire." small, then "Stronger together" at display size as the core reaches full brightness and the
   sun clears the horizon.
Risk: low; reads well but says less (it shows "same light", not "neither alone").

### C. Two waves, one crest
The idea: stronger together as constructive interference, on the lava (where the journey swoops low).
1. (0 vh) Hero; the camera starts its swoop down to the sea.
2. (0.3 vh) From the mark's reflection two wave trains leave toward the viewer: from the arcs' side one long smooth swell
   (continuous), from the squares' side a regular train of short crisp ripples (steps). Captions ride on each:
   "Judgment" / "Range".
3. (0.6 vh) Where they cross under the type they add into one taller, brighter crest that runs under the line
   "Stronger together" and lifts it (the floating text rides it).
Risk: high (needs the lava module's cooperation, two visibly different wave trains at cosmic distance read as noise on a
phone, and the mark itself is not part of the beat).

Recommendation: A. It is the only one where the logo's own construction (continuous half, stepped half, one empty step
at the top and the meeting at the bottom) is the explanation, it needs nothing to move, and every frame is a lit, rigid
cast object, which we can make look like film.

## Lab prototype of A (07:12 UTC): `lab/mark/proto.html`
- `node lab/mark/shoot.mjs <out> "<query>" <beats> iphone|desk` renders frames (SwiftShader, ~1 s per frame).
- The mark is a real 3D object: Jacob's 2D geometry (exact `lib/splitRing.ts` numbers) extruded by an SDF with a rounded
  bevel (depth 2.4, bevel 0.5 mark units, as `lib/gl3d` `logoPieces`), ray-marched inside its slab box only (~10 steps
  for most rays). The core is a sphere emitter (heart, orange skin, deep limb, a slow large-cell boil) and a sphere
  light: GGX with the representative-point trick for the specular, soft shadows of the pieces toward it (the inner arc
  shades the outer arc's inner wall, with a penumbra from the core's size), the dusk and the lava's glow mirrored by
  the metal. Silhouettes are anti-aliased from the ray's closest approach.
- The heat front: temperature 0..1 from the angle since the front passed (arcs: per pixel; squares: from their centre
  out over 0.05 rad, so each lights whole, quickly). Colour = Planck at three wavelengths from 800 K to 3200 K, on a
  perceptual brightness curve. A hot face mirrors less of the cool sky (a glowing face that kept the blue reflection
  read pink).
- Shots: `shots/A-sequence-desk.webp` (beat .3 .55 .73 .82 .92), `shots/A-iphone.webp` (0, .45, .73, .82).

## A, round 2 (coordinator's fixes, 07:20 UTC)
- Gravity: the two runs leave the top together and accelerate (angle = pi(0.3u + 0.7u^2)); each is a liquid run with a
  rounded tongue (ahead in the middle of the stroke, held back at the walls), white-hot tip, orange body, a cooling
  tail. Squares are little moulds that fill bottom-up (a level line) as the run reaches each, with a short heat bloom.
- The weld: one flash at the bottom when both arrive; heat runs back up both halves at once; the blaze is
  emission-dominated (hottest where they met, Ember toward the top), specular nearly gone, emissivity lower at grazing
  angles so the glowing pieces keep their form, a slow smooth shimmer flowing down.
- Setting: a crisp bone front runs down both halves in the order the metal was poured (outer ring a little ahead), the
  weld last; ahead of it the metal cools orange to dull red. No Ember-to-bone mix. A radial "outside-in" sweep was
  tried and rejected: a circular front cut the squares into crescents (read as a clipping bug).
- Cold: bone cast metal (diffuse + bone-tinted sheen), lit by the core (sphere light, soft shadows), a warm fill from
  the glowing sea below, a cool sky fill and a thin starlit line on the top bevels. Fill colours are inputs (the world's
  sky/sea decide them).
- No grain or normal noise on the metal: tried twice, at this scale it only read as specks and mottling.
- The sea reflection is no longer drawn here (lava/world own it).
- Shots: `shots/A2-iphone-beat.webp` (iPhone 15: beat 0 .2 .4 .55 / .62 .68 .8 .97), `shots/A2-desk-beat.webp`.
