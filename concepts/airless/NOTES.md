# Airless

## The idea
Crucible's home page as a trip around a small world with no air: a molten sea under a black, star-filled sky. The core of the mark is the sun, hanging just above the sea, and the two rings are its halo: continuous metal arcs on the left, lit cubes on the right. Its reflection lies across the swell, with ripples spreading out under it. Scrolling moves the camera off a black-sand shore with lapping molten surf, out over the open sea, across a sand island, past slabs rising out of the lava, up over the planet's limb into a sunrise, and back down on a far shore where the footer's surf runs under the wordmark.

## How Quench (the cold accent) is used
Quench (`#7fb6ff`) is used only for cold things, roughly 5% of any screen:
- the cold moon low in the sky: a Quench crescent lit from the sun's side, its night side faintly warm from the sea;
- the cooled outer rims of the halo's arcs and cubes, which catch starlight;
- starlight fill from above on the black sand and on the cooled Crucible Sites slab;
- the blue-white stars;
- one UI element, the star-chart readout (bottom left, desktop): longitude round the planet, the sun's altitude and the camera's height. It is real data from the scene, so it is the only monospace on the page.

Ember stays the only hot UI colour: the core, the CTAs, the "Live" dot, the ı dot, focus rings.

## What is real-time (one WebGL2 canvas, raw, no libraries)
- **Planet and sea.** A sphere (R = 200) ray-traced per pixel. The lava is a crust of dark plates with glowing cracks (blackbody ramp), filtered by pixel footprint so the far sea averages to a deep red glow. It carries an analytic swell that never stops, ripples centred under the sun, Fresnel reflection of the whole sky (stars, corona, halo, moon), a sun glitter column and a thin hot limb line.
- **Black sand.** A height-field raymarch for the shores, the island and the dunes on the horizon. Hard sunlight, a glassy sheen, sparkling grains, warm light from the sea, and Quench fill from above.
- **Surf.** A swash runs up the beach fast and drains slowly. Its phase wanders along the shore, it has a white-hot lip, and the wet sand it leaves glows and then cools to black. Thin glowing crests run in toward the shore before each run-up.
- **Sky.** Crisp stars that don't twinkle (two or three layers, sized to one pixel), a faint galaxy band, zodiacal light along a tilted ecliptic through the sun (the "light colour" in an airless sky), a corona with streamers, and a sharp disc that is white-hot at the centre and Ember at the limb. There is no haze and no blue gradient.
- **The mark as the halo.** It is drawn in the sun's own angular frame at Jacob's new geometry (`lib/splitRing.ts` @ e480844, 48-unit grid): rings r 20 and 12, stroke 2.6, upright squares 3.2 (7 on the outer ring at 22.5° steps, 4 on the inner at 36°), and the core 3.6, which is the sun's disc. The halo's size is set from the sun's radius, so the proportions hold wherever it appears. The same mark is in the nav and cut into the Crucible Sites slab. The hero's scroll beats move it: "Not the person" scatters the cells (tilted 11° at most), "Not the model" sends the arcs away, "Neither, alone" brings everything back and the core flares.
- **Wakes.** A GPU wave equation (RG16F, 256², 120 Hz substeps) on a 52-unit patch anchored to the world. It follows the camera in whole texels. The pointer or finger is a zero-mean dipole (up ahead, down behind) swept continuously along its path, so it leaves a bow ridge and V lines, never drops or a lasting trough. A tap is one zero-mean drop. The waves are slow, as in viscous lava (about 6 units/s), so medium and fast strokes go "supersonic" and draw a V. Crests glow from the field's curvature (crust stretched open); troughs cool slightly. The sun's glare from wake normals is halved so the wake reads as lines. Scrolling over a resting cursor or finger also makes a wake, because its hit point moves across the sea.
- **Text in the world.** Display lines are drawn into a 2-slot atlas from their own DOM glyph boxes. The thesis line and the giant wordmark get a real reflection in the lava, distorted by the waves. The hero headline and beats cool the crust under their letters (a soft glyph-shaped shadow of cold crust), and body text cools a soft raft under itself. The sea under type is darker by temperature, which keeps text AA without boxes.
- **PayPal.** A plan view of a calm, dark sea. One molten pool ("PayPal") sends out a wave. As the wave reaches each of six places, a casting ignites there: a pool with a crisp hot rim that keeps rippling. A channel of flowing metal links each casting back to PayPal. Everything is scrubbed by scroll, keeps moving at rest, and stays in the world as the camera moves on. The labels are projected from those world positions, which come from screen positions cast back onto the sea, so the composition holds on any screen.
- **Ventures.** Three cast slabs rise out of the sea one by one. Crucible Sites has cooled to bone metal, with the mark cut into its face and an Ember core, lit by the sea and the sun. Verge and Trellis are still forging: blackbody glow and drifting crust with cracks, hottest where they leave the lava. Each has a hot meniscus and ripples, and is reflected in the sea. Hover, focus or a touch heats and lifts its slab and pushes the arrow. Each row is a plain link with an always-visible arrow button, so it works by tap on iPhone.
- **Camera journey.** Keyframes are attached to section scroll positions and followed by a critically damped spring. The sun can be placed on the surface (so the ripples sit under it) or by direction (the sunrise over the limb). Phones get their own pitch and size overrides.
- **Performance.** DPR is capped at 1.5, and there are 6 render-scale steps that drop after about 0.8 s of slow frames and climb at most twice. Software GL starts at step 4. The sand march is skipped where no sand is in range, and work stops in hidden tabs.
- **Reduced motion.** The clock is frozen at a chosen frame, there is no sim, and the page re-renders only on scroll, so every scene is a still. With no JS or no WebGL2 the page falls back to a dark molten-glow background with all content readable.
- **Test hooks.** `?t=<s>` holds the clock, `?q=<0-5>` sets quality, `?notext` hides the DOM; `window.__step(dt)`, `__hold()`, `__resume()`, `__state()`.

## Round 2 (coordinator review)
- **Type never shares the frame with the mark.** The hero mark sits above the sea and the type sits on black sand. In the story, PayPal and Charlie's chapter the camera faces away from the sun, so the type has the night sky to itself. In ventures the sun sits low behind the slabs, under the heading. In the thesis it sits to the right of the type, then rises off the limb below it. Phones get their own keyframe overrides.
- **The whole mark floats above the sea.** In the hero the sun is placed by angle so its lowest square clears the horizon plus a gap. The sea reflects the mark, broken by the swell.
- **The halo is lit from the sun inside it.** Hot inner rims face the core, the far faces are dark, and a starlit Quench rim runs along the outer edges.
- **Jacob's sentence appears once.** It is set in place inside his paragraph as the display break-out; the text itself is unedited, only split around the break-out.
- **Verge and Trellis are one seamless glow,** with no crust or cracks: hottest where they leave the sea, with a slow breath of heat. They are bigger on phones (the camera moves closer).
- **No glyph shadows behind type.** Legibility comes from composition.
- **PayPal is organic.** Three curving trunks of varied width leave the pool, fork, and taper into the six castings, revealed by PayPal's wave and flowing. There are no straight spokes and no ring around PayPal.

## Tested (Playwright Chromium with SwiftShader, deterministic frames via `?t` and `__step`)
- **Hero:** idle over about 5 s in 8 frames (swash runs up and drains, crests come in, glitter moves); the three beats; 2× crops of the shoreline. That found and fixed a black contour line at the waterline caused by a wrong inverse of the drain curve.
- **Cursor:** medium and fast strokes. A first version made a lasting trough (net volume), then glare; the dipole source plus curvature glow fixed both.
- **Every section** at 1440×900 and on iPhone 15 (390×844).
- **Touch** via CDP: a finger drag on the sea makes the wake; a touch scroll scrolls the page (0 → 202 px) and keeps drawing. A horizontal finger drag used to trigger Chrome's swipe-back navigation; fixed with `overscroll-behavior-x: none` (iOS has the same edge gesture).
- **Reduced motion** (`reducedMotion: 'reduce'`): the clock stays frozen and the stills render. No horizontal scroll at 360 px (scrollWidth 360).
- **Size:** the page is about 89 KB; the only network requests are Archivo from Google Fonts.

Screenshots are in `shots/`.

## Production next steps
- Port into the site's one-clock architecture: the scene in a Worker with OffscreenCanvas, the sim on `loop.ts`, floaters riding this sea via `footprint()`, and the existing `field.ts` replaced by this patch.
- Measure on a real MacBook and iPhone. The raymarch is the cost; precomputing the sand as a height texture would halve it.
- Replace the CRT placeholders with Jacob's CRT portrait art; give Verge and Trellis their own marks on their slabs once they exist.
- Lighthouse pass: on low-end devices, defer the canvas until after load and idle (the headline already paints without it).
- Possibly a second wake band (finer waves) for the scroll wake, as the current site does.

## Questions for Jacob
1. Is the halo-as-logo right? The mark is literally in the sky around the sun. Or should the rings be thinner and more like a ring system, so the sun reads more as a sun?
2. On the phone hero the sea is a narrow band, because the headline needs dark sand under it. Do you want more sea and less sand there, with the headline moved up into the sky?
3. The PayPal moment as one pool feeding six castings: do the flowing channels read as "one company seeding six", or too much like a diagram?
4. Should the star-chart readout (longitude, sun altitude) stay? It's the one Quench UI element.
5. Is the footer's setting sun under the wordmark the right ending, or do you want the full mark back there?

## References studied (what each taught)
1. Apollo 17 and LRO surface photography: on an airless world the sky is pure black even in sunlight, shadows are hard, and stars only show when your eye is shaded. That's why the stars here are crisp and non-twinkling and the sky has no gradient.
2. Clementine and SOHO imagery of the solar corona and zodiacal light: the only "light colour" an airless sky has is a pearly corona and a cone of dust light along the ecliptic, used here as the sky's warm light.
3. Shadertoy "Seascape" (TDM) and iq's terrain articles: an analytic ocean whose wave detail fades with pixel footprint, and raymarched height fields with growing steps. Used for the sea's filtering and the sand.
4. Evan Wallace's "WebGL Water" and m-ender/webgl-ripples: a GPU wave equation in a ping-pong texture with sources stamped into it. The basis of the wake sim.
5. The Kelvin wake pattern (scipython write-up; Kelvin wake simulation repos): a V wake needs the source to outrun the waves, hence slow lava waves and a swept dipole source instead of drops.
6. Awwwards WebGL scroll journeys (Hanwha Ocean, Convex Seascape Survey, Into the Amazon SOTD): one continuous camera path tied to scroll, with each section a place on the way, beats the stacked-sections pattern.
7. Interstellar's Gargantua and real eclipse photos: a thin, sharp ring around a bright disc reads as monumental at small sizes, so the halo is drawn crisp and lit from the core side.
8. The current site's footer furnace (`lib/gl/furnaceGL.ts`): its blackbody ramp and the bright rolling lip Jacob loves are reused as the sea's palette and the surf's lip.
