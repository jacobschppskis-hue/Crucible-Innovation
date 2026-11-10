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

## Afternoon (14:20-15:00 UTC)
- Light at the place: look's cold moon (`look.moon` 1.2, az 150, el 12 in `venturesKeys`), used as a second
  anisotropic GGX light; each face is aimed just off the half vector between the camera and the moon, so it carries a
  cool sheen band and cold fillet lines over the hot glowing foot. The monoliths' own light (heat, pool, lava-lit air)
  is scaled to look's radiance unit (`GAIN` 4).
- Out of their place: they sink back into the sea over the first 22% of the thesis pin, and they are off the trace
  (uP.w = 0) when the camera is more than 8 km away.
- Text: solid bone everywhere (AA over the sea); the near sea is a little cooler through the place (`ventures_uCool`).
- Layout: armed from the world's first frame; phones pitch +8 (monoliths between the lede and the list).
- Without the world: each venture shows its still (public/film/monoliths, from `scripts/monolith-stills.mjs` via
  `lab/ventures/still.html`); pages use the same stills on /ventures.
- Perf (SwiftShader, 1440x900, q4): a ventures frame ~7.5 s vs story-3 ~6.3 s. Optimisations: the march starts on the
  casting's box (24 steps primary, 10 in reflections), one look_sky per pixel, a cheap reflection path.
- Checked: a touch tap on the Sites monolith's hit area lands on its link (iPhone 15 emulation).

## Nov 10 (overnight): three monuments, not three props
The reviewer: small on phones, a plain CG chrome gradient, a tiny soft mark, frames at f 0.5 and 0.85 identical.
- **Scale by lens and distance.** SCALE 15: Crucible Sites is 150 m tall (Verge 138, Trellis 127: three shapes,
  `MONO_SHAPE`, three finishes, `FINISH`), 600-750 m from the camera. The camera (`venturesKeys`) is low (h 24 -> 14)
  with a long lens (key fov 30 -> 26; phones 31 -> 25, which the portrait rule turns into ~40 -> 32 deg vertical). On a
  6 km planet the horizon at h 14 is only 410 m away, so the far two stand a few metres hull-down: that IS the planet's
  curve. More than ~150 m tall is not possible with the waterline in view from a low camera; the read of size comes
  from the lens, the haze and the stillness (no bob, no tilt, hover = heat).
- **look_atmo is not applied to them.** look's air is scaled to the small planet (about 1 unit per km of real air):
  at 700 units everything turns into a ghost the colour of the sky. Own haze instead: the lowest ~7% of each casting
  and a little of the far ones fade toward look_sky right behind (colour mix, never alpha: stars showed through).
- **Why the old faces read as a chrome gradient:** the face was crowned 0.1 rad across its width, i.e. a cylinder,
  and the grain ran across it, so every light made one vertical stripe. Now flat (crown 0.018), the grain runs UP the
  shaft (lobe wide across, tight along), so the moon lies across the upper face as a soft band; the mirrored horizon
  (sea below it, sky above) sits at about a quarter of the height and is the warm underlight; polish drifts over tens
  of metres (two noise octaves under one cycle per face). The moon is desaturated to silver on metal (a whole face in
  Quench was a blue slab) and drifts az 141 -> 158, el 8.5 -> 5.8 through the pin (keys), so the sheen passes from
  Trellis to Crucible Sites and down the faces while the camera arcs (x -30 -> +30 m).
- **Fixed in the world:** each face looks at the camera's peak position (PEAK) plus its own turn (AIM); they no
  longer follow the camera, or nothing would travel across them. They stand parallel to the CAMERA's vertical
  (lean dist / R toward it, plus LEAN): the curve would otherwise tip them 6 deg away and the faces would mirror only
  black sky.
- **The dusk** (the env's glow where the sun is under the limb, 35 deg right of ahead): only grazing reflections see
  it, i.e. the right-hand side faces and arrises: the bright warm line. An arris narrower than a few pixels gets its
  normal spread as roughness (no flicker, no dark outline at dpr 3; at dpr 1 it is a 1 px darker line).
- **Heat:** T = 560 + (Tw - 560) exp(-h / Lh), Tw 1150 K (live) / 1250 K (forging), Lh 6% / 16% of the height.
  Everything emissive is x56 in look's unit, so anything over ~1000 K clips to the same orange: keep gradients between
  800 and 1150 K. (A film floor of 770 K once lit a whole casting dull red: the film term is gated by th.)
- **Rising:** the sea domes up first (an ellipsoid smooth-unioned into the SDF, its rim fading into the pool), the top
  comes through it, and the melt drains in broad rounded curtains (low-frequency noise on the film's length; sharp
  tongues read as flames). Each rise takes 36% of the pin; they sink again over 0.895 -> 0.995.
- **Reflections moved from the crisp pass to the sea hook** (`m.emit`, scene scale): a closed-form column per
  casting: the mirrored ray is followed to the casting's plane and a box kernel (0.055 x distance: the swell's slope)
  smears the glow profile and the face along the height. Sharp at the waterline, long toward the camera, continuous by
  construction; the crisp box is now only the castings.
- **The last key equals thesisKeys' first** (s 151.5 deg, h 30, fov 50 / 64): no cut at the boundary. If the thesis'
  first key changes, change `['ventures', 1]` with it.
- The stills harness (`lab/ventures/still.html`, `scripts/monolith-stills.mjs`) still speaks the old interface
  (`ventures_uE` as one vec4, `ventures_skyA`, `ventures_uSunL`): it needs porting before the stills are re-rendered.
