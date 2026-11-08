# ventures: the metal monoliths

Jacob: "The metal monoliths rise out and they're made of metal, but shiny, shiny slightly, but maybe still glowing near
the bases. Make it actually look like metal and good, not like the slop that you've previously generated where it looks
really dumb and has flaking on it."

## Research takeaways (timeboxed)
- **What made the old castings slop** (Airless `monoShade`, `lib/gl3d/materials.ts` 'bar'): metal shaded as a diffuse
  albedo times light, plus fbm "sand grain", pits and crust. Metals have no diffuse term; texture noise on albedo is what
  reads as flaking/dirt. Real metal is almost entirely what it reflects.
- **Conductor Fresnel.** Measured F0 (linear): iron/steel 0.56/0.57/0.58, nickel 0.66/0.61/0.53, titanium 0.54/0.50/0.45,
  platinum ~0.67/0.64/0.59 (Unity/UE measured tables). Schlick is within ~2 dE for most metals (Hoffman, "Fresnel
  Equations Considered Harmful", 2019); the grazing dip is added with the F82 edge tint (Kutz et al. 2021, as in OpenPBR
  and Cycles). Used here: F82-tint Schlick.
- **GGX + Smith (height-correlated)**, split-sum environment (Karis' analytic DFG fit, cheap on mobile).
- **How big metal reads in photographs and film:** the reflected horizon line running across the faces (sky above,
  ground/sea below), crisp highlights on the bevels/fillets, a slow waviness that bends that reflected line (no casting
  is optically flat), and roughness that varies only gently (polished high points and edges). Dark faces are correct
  under a dark sky; contrast comes from the edges and from whatever bright thing is in the mirror direction.
- **Cast objects:** a draft angle (sides narrow toward the top, 1-5 deg) and rounded fillets are the cues of a casting;
  sharp CG box edges are the cue of a game asset.
- **Incandescence:** colour from Planck's law (Draper point ~798 K dull red, ~1000 K cherry, ~1200 K orange, ~1500 K
  yellow, ~1800 K yellow-white); a hot surface emits with emissivity 1 - reflectance (Kirchhoff), so polished hot metal
  glows less at grazing angles than face-on. True luminance spans ~5 decades between dull red and yellow; compressed to
  T^6 so the fade up the shaft reads over a long stretch.
- **Avoided on purpose:** oxide scale (it is literally flaking), temper colours (thin-film rainbows read as CG unless
  very controlled; may revisit as a faint straw/bronze band), dripping rivulet "tubes" (tried: read as neon/fire).

## Decisions
- Shape: an upright cast stele, half extents 1.6 x 5.0 x 0.42 (w:h:d = 1 : 3.1 : 0.26), 3.5% draft, fillet radius
  0.12, continuing 30% of its height below the waterline (so a lift on hover never shows the underside).
- Materials: Crucible Sites = warm nickel-silver (F0 0.74/0.70/0.62, roughness 0.34: satin, cast) with Jacob's mark cut
  into the front face (sand-cast rougher inside the cut, chamfered walls catching the light) and its core still liquid,
  ~1150 K (Ember chroma) under a glossy skin. Verge and Trellis = steel (F0 0.56/0.57/0.58, roughness 0.20, slightly
  shiny), still hot: 1520 K at the waterline falling with a scale of 10% of the height to a 700 K body.
- Rising: a melt coating that only changes temperature and gloss (hottest at the waterline, scale growing with
  "freshness", long soft streaks), a function of rise, so reversible.
- Hover/focus/press: heat rises (waterline +120 K, glow climbs ~2x higher), lift (engine), ripple (lava module).
- The monoliths carry no text; names and info are DOM next to them (Archivo). Verge/Trellis carry no marks yet
  (their SVGs are placeholders).
- Lighting recommendation for the world camera (v2 frames): the sun low BEHIND THE CAMERA's shoulder (40-70 deg off
  the view axis), so the monoliths stand in warm low light against the dark anti-sun sky (the Dune look: lit
  monuments, dark sky). The steel then shows a long brushed sheen and the Sites face reads bone. Keep the sun's mirror
  direction off the broad faces (or the exposure low), or the satin face burns out on a phone. Straight backlight
  makes three black slabs with lit edges (v1 frames); usable, but it does not read as "shiny".
- Waviness: one slow, mostly vertical octave (0.6% slope). A second, finer octave showed as mottling inside the sun's
  lobe (the "dirty" look), so it was removed.

## Contract offered to `world` (until ARCHITECTURE.md lands)
`lib/world/glsl/monolith.glsl`: `monoTrace(ro, rd, tMax, out MonoHit)`, `monoShade(hit, rd, pixAng)`,
`monoSeaGlow(p)` (extra lava emission around each foot), uniforms `uMonoP/M/K/E`, environment `uMonoSun`, `uMonoSunL`,
`uMonoZen`, `uMonoHorW`, `uMonoHorC`, `uMonoSea`, `uMonoPool`, clock `uMonoT`. The lava shader should call `monoTrace`
for its reflected rays (the monoliths' reflections) and add `monoSeaGlow`.

## Lab
`lab/ventures/index.html` (stand-in sky and sea), `node lab/ventures/shoot.mjs <out> "<query>|<name>|<WxH>|<dpr>"`.
Query: `view=desk|phone|close|low`, `sun=back|side|front`, `rise`, `rise0..2`, `hov=<i>&heat=`, `press=`, `t=`.

## In the engine (13:40-14:05 UTC)
- Ported as the `ventures` world module (hooks hit / shade / env / sea; `keys` own the camera through the place: the
  lead's path with the horizon lower, phones pitch +5 so the monoliths stand between the heading and the list).
- 110 m monoliths ~420 m ahead of the place's first key (read from journey.ts), leaning 5-8 deg toward the viewer so
  the faces mirror the glowing sea, not the black night sky. Reflections: look_sky (cone-filtered), an analytic sea +
  pool, and a warm band of lava-lit air over the horizon (the faces' bright line). Sun: look_sunLight (out at night).
- Not done: monolith stills for /ventures pages and the reduced-motion home (asked by pages; missed the 12:00 slot
  because this session's worker was down); WebKit; a real-GPU frame-time check.
- Frames: shots/engine-*.webp.
