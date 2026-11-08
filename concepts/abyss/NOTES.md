# Abyss: notes

## The idea
The mark is Jacob's logo family (rings 20/12, stroke 2.6, 7 + 4 squares of 3.2, core 3.6 on the 48 grid). The camera looks straight down at a molten sea, and the whole page is its surface: dark crust plates with glowing
seams drift on it, a slow swell runs under them, and your cursor or finger cuts a wake through it like a boat. The
Split Ring floats in a pool its own nucleus keeps open, with concentric ripples spreading out from the core. Everything
else on the page also lives on the sea: headlines are cooled metal slugs that surface hot and cool to bone, the ventures
rise out of the lava as cast bars, PayPal's six companies come down rivers of metal, the Thesis heats the sea until only
the alloy holds, and the page ends on a black sand shore with glowing surf.

## Quench (the cool accent)
Used only for cold things, never for UI chrome except one status dot:
- the sky reflected in the crust's glass: a pale, cool dusk that slides across the plates as the swell tilts them
  (this is the "light colour in the sky"; top-down you only see the sky in reflection), with tiny cool glints on wave faces;
- a cool line along the top bevel of every cooled plate (light from above) and the cool fill on the ring's pieces;
- the cold glints in the black sand of the footer shore;
- the "Live" dot on Crucible Sites (cooled = done), against the Ember dots of the two ventures still molten;
- a faint cool sheen in the CRT glass.

## What's real-time
All of it, in one WebGL2 fragment shader over one fixed full-screen canvas plus a GPU wave grid:
- wave grid: a damped wave equation on cells (4 px desktop, 3 px phone) anchored to the page (scroll shifts it by whole
  cells, so wakes stay where you made them), 120 Hz substeps; the pointer is stamped as a continuous segment per substep,
  so a wake is one smooth line with its V of ridges, never a row of drops; a drag also "breaks" the crust (third channel)
  which opens a glowing keel line that heals over ~2 s;
- an analytic swell (four long waves, the same sum on the CPU for anything floating);
- crust (two Voronoi levels, jagged, drifting), the pool around the nucleus with its ripple glints, the logo's pieces
  (2 arcs, 11 squares and the core as SDFs, bevel-lit by the core, cool fill from above), plates, venture bars (bone cast bar with the mark cut in it, or
  molten with drifting crust), PayPal's rivers (quadratic paths, a hot front, cooling to seams), the shore (three swash
  trains, a white-hot front line, wet sand, cold glints).
- CPU: springs for the logo pieces (swell, story beats, pushed by the cursor, shedding ripples only when pushed),
  surfacing/cooling of every plate, bobbing of text with the swell under it.
- Quality: render scale steps 1.5 to 0.5 by frame time, DPR capped at 2, software GL starts at the lowest step; the
  CRT noise and scene work only run on screen. `?t=`, `?q=`, `?paused`, `window.__step(dt, n)` for exact frames;
  `?still` (or prefers-reduced-motion) renders one composed still per scroll position with the pinned scenes flattened.

## To bring it to production
- Split the one shader into passes (sea at reduced resolution + objects at full) and move it into a worker with
  OffscreenCanvas like the current liquid; share the wave grid with `lib/liquid` instead of a second model.
- Replace the SDF venture bars with the real ingot renderer (`lib/gl3d`), seen top-down, keeping the surfacing.
- iOS: the fixed canvas can lag the DOM by a frame during momentum scroll, so plate rims may trail text by a few px;
  production should draw the plates' rims with a one-frame scroll prediction or let text plates be DOM-only.
- Real CRT portraits when Jacob sends the photos.

## Questions for Jacob
- Top-down loses the horizon (and the sunset sky). Is the sky in reflection enough, or do you want the hero to start
  at a low angle and tilt down to top-down as you scroll?
- Should the cursor's keel line glow (it reads as "cutting the crust"), or only the waves?
- Is the cool Quench in the crust reflections the right amount, or should it be even rarer?

## References (researched before designing)
- Lava-lake aerial footage (Erta Ale, Nyiragongo): thin bright cracks, plates of very uneven size, whole reaches crusted
  dark while others are active. Took: activity varies by region; most seams dull, a few bright.
- Inigo Quilez, Voronoi edges and F2-F1 borders; nimitz's "Lava" shaders on Shadertoy: domain-warped cells, temperature
  ramp instead of colour picking. Took: jagged warped seams, blackbody ramp.
- Evan Wallace, "WebGL Water": a GPU height-field wave equation, caustic/reflection shading from normals. Took: the grid.
- Kelvin wake pattern (Wikipedia; scipython "The Kelvin wake pattern"; a Liège thesis on real-time ship wakes): the V
  forms from a moving source; amplitude per length of path. Took: segment stamping per substep, strength by speed.
- shadcn "magma shader": top-down drifting crust plates on Voronoi. Took: plates as Voronoi, but warped and uneven.
- Awwwards: "Into the Amazon" (SOTD Apr 2025, a drop of water's journey told by scroll) and "The Spark" (SOTD Dec 2025,
  scroll-driven 3D story). Took: one continuous world, scroll as the camera.
- TDM "Seascape" (Shadertoy): sky reflection on a dark sea is what makes water read. Took: the sky only in reflection.

## How it was tested
Playwright Chromium on software GL (SwiftShader), frames stepped exactly with `?paused&shot` + `window.__step(dt, n)`:
hero idle (9 frames over ~6 s: the nucleus breathes a ring every 1.9 s), the hero story at 7 scroll positions, cursor
paths at 220 / 700 / 1400 / 2200 px/s plus a mouse drag (and a debug view of the raw wave grid, `?dbg=1|2`, to confirm a
clean two-armed V rather than a trough), the phone view (iPhone 15) with a finger drag and a finger held while the page
scrolls under it (the cleanest V wake of all), every section at 1440x900 and 393 wide, 2x crops (ring, bar, pool),
venture hover, reduced motion (stills per scroll position), and 360 px (no horizontal scroll anywhere).
Not tested: a real GPU frame time (no GPU here). The shader is one full-screen pass with two Voronoi levels and ~8 noise
lookups; the render scale steps down on slow frames, so a MacBook should hold 60 fps at a lower step if needed, but this
is the first thing to measure on hardware. Shots in `shots/` (07 still shows the PayPal rivers crossing, fixed since).
Known: faint 1-cell column stripes can show in the pool at 2x under strong ripple light (half-float grid sampling).

## Round 2 (coordinator review)
- The sea is now calm almost everywhere: a thin dark glassy skin with a faint deep-red undertone, the long swell and the
  cool sky in it. Crust plates and bright seams only round the ring's pool, under the Thesis heat and in the surf; a
  wake's keel cuts the skin to the glow below and heals.
- No plates or outlines behind any text: type sits straight on the sea; under words the shader caps anything hot so
  text stays AA. Headings still surface hot and cool to bone; ripples close round them as they come up.
- Jacob's "I want to know what happens..." is set once, in place, growing inside his paragraph.
- Verge and Trellis are one seamless glow (no crust), still rising out of the lava.
- PayPal: one river leaves PayPal and branches, meandering, into six; each ends in a small pool beside its name; no boxes.
- The ring's pieces read as smooth cast bone metal; the pool and ripples are unchanged.
- Verge and Trellis are crisp cast bars at heat: chamfered walls lit like metal, a bright fillet, the name cut into the
  top. The Thesis follows the ventures directly; its words surface as they arrive and the sea starts warming before the pin.
