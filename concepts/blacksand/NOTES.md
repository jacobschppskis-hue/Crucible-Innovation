# Black Sand

## The idea
The footer's glowing surf moves to the top: a molten sea at dusk rolls onto a black-sand beach and laps it constantly,
and the beach is a sand mould. Every wave that reaches the giant "crucıble" pressed into the sand fills the letters
with metal, which then cools to a cracked skin until the next wave refills them. The logo's core hangs over the water
as the sun, drawn inside a hairline ghost of the mark (Jacob's logo family: rings 20/12 on the 48 grid, 7 + 4 squares), and the same coast runs down the whole page (the sea along the
right edge, opening into coves between sections) until it turns again under the footer's wordmark.

## The cold colour (Quench, `#8ab8f0`)
Used only for cold things, about 5% of any screen at most:
- the pale band of sky above the horizon glow, and the starlight high up;
- the hairline ghost of the mark around the sun (a cold, cool-white line);
- the faint sheen on cooled wet sand, and the steam that rises off it after the surf leaves;
- the phosphor of the CRT test cards;
- one UI accent: the thesis's kelvin readout starts at 293 K in Quench and heats through bone to Ember as you scroll.

## What's real-time
Everything on the ground is one WebGL2 fragment shader on one fixed canvas (no library, no textures except the text
atlas and a 1-D coast profile):
- **Ground mapping**: page-anchored. Above the hero's bottom the ground is seen in perspective (horizon, sky); below it
  the ground is the page at 1:1, joined with matching slope, so the beach seen at an angle becomes a map of the coast as
  you scroll. Sections sit on the sand; the coast is laid out from the DOM (`[data-sand]` boxes), hugging the right
  edge of the text and opening into coves in the gaps.
- **Swash**: an analytic run-up (fast uprush, slower backwash, random reach per wave, phase varying along the shore), so
  every point of sand knows exactly when the metal last left it: wet glow, cooling, gloss and steam all follow from it.
  Incoming waves are in phase with the swash they become, their faces opening fresh metal, and they break into foam.
- **Sky**: gradient with a pale cold band, stars, basalt sea stacks and a headland, the sun with the mark's hairline
  ghost. The sea reflects it all with Fresnel from each row's camera ray: the sun's glittering column, the stacks, the
  ring. Ripples spread from under the sun.
- **Cursor and fingers**: a damped wave-equation grid (half-float ping-pong, 4-5 px cells, 120 Hz substeps), anchored
  to the page (shifted by whole cells on scroll). A moving pointer is stamped as a continuous segment per substep, so
  above the wave speed it leaves a V wake with smooth ridges and below it a bow ripple: no drops. A resting cursor or
  finger makes a wake as the page scrolls under it. Dragging on the sand scores a glowing furrow that cools.
- **Type in the sand**: a canvas atlas of the wordmark and venture names (Archivo), blurred for the mould's walls.
  Lit from the sea's side, it's filled with metal: the wordmark by the surf, Crucible Sites cast and cooled to bone (it's
  live), Verge and Trellis still molten with a drifting crust (still forging), each fed by a gate channel from the sea.
  Hover/focus/tap heats a venture's cast and its "Open" control turns Ember.
- **PayPal delta**: one river of metal leaves "PayPal" and splits into six channels that run down the beach into the
  surf; the names light as the metal reaches them. Scroll pours it (latched, so it never un-pours), pulses keep flowing.
- **Quality**: DPR capped at 1.5, render scale steps (1 → 0.42) on slow frames, back up at most twice; one rAF.
  Reduced motion: one still frame, re-drawn on scroll. Test hooks: `?t=<s>` (fixed time), `?q=<scale>`,
  `window.__step(dt, n)`, `window.__render()`, `window.__blacksand`.

## References (researched before designing)
1. Footer furnace of crucibleinnovation.com (`lib/gl/furnaceGL.ts`): the palette and the veined metal Jacob loves,
   reused here as the blackbody ramp.
2. Reynisfjara, Iceland: a black-sand beach with basalt sea stacks offshore; the silhouettes on the horizon come from it.
3. Shadertoy "Seascape" (TDM): sky reflected with Fresnel from a cheap height field; the far sea here does the same.
4. Shadertoy "Castaway" (cited on the Babylon.js forum for realistic surf on a beach): surf as a band that runs up the
   sand rather than as a texture.
5. Evan Wallace, "WebGL Water" (madebyevan.com/webgl-water): an interactive wave-equation height field; the wake grid.
6. Shoreline shaders in game engines (Unity and GameDev.net threads on shoreline foam / flow-mapped foam): a coordinate
   across the shore drives foam and run-up; here it's the signed distance to the coast.
7. Codrops, "Creating a Water-like Distortion Effect" (2019): a canvas of pointer trails driving a shader; the pointer
   stamping here is a segment per substep instead of trail dots.
8. Awwwards Sites of the Day with an ocean hero (Convex Seascape Survey, The Ocean Agency): the sea fills the screen
   and the type sits on it; they keep UI to a minimum over the water, as this page does.

## To bring it to production
- Port to the site's architecture: the shader into `lib/liquid/` (the sim already exists there: reuse `sim.ts`/`input.ts`
  and its scroll wake instead of this page's grid), the one clock, a worker with OffscreenCanvas, `[data-sand]` layout
  from the existing InView measurements, and the static light tier as a captured still per breakpoint.
- Replace the hero wordmark's canvas text with the real wordmark outlines (the spark-i Ember dot is approximated).
- Profile on a real iPhone (the shader is one pass but heavy: fbm, the bezier delta, the mark SDF in reflections);
  likely move the sky into a cached texture and skip the delta outside its box with a scissor.
- Founders' CRT portraits from the photos, in the same test-card frame.

## Questions for Jacob
- The giant wordmark in the sand fills and cools with each wave. Should it ever cool all the way to bone (the cast
  set), or stay glowing as it is now?
- The coast runs down the right edge of every section. Is that too much orange through the long story text, or is it
  the motif? It could pull back to a thin fringe in the reading sections and open up only between them.
- Should the sea be wider on phones (it's a fringe at the right edge, opening into coves between sections)?
