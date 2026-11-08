# look: notes

Look development for the final build: the sky, the thin atmosphere, the planet from far out, the sun (= the core's
light), the image pipeline (HDR, bloom, AgX, grain, dither). Lab: `lab/look/index.html?scene=<preset>` (serve the repo
root, e.g. `python3 -m http.server 8765`), frames with `node lab/look/shoot.mjs out.png "scene=hero&w=390&h=844&dpr=2"`
(SwiftShader), sheets with `python3 lab/look/sheet.py out.png <cols> a.png b.png ...`.

## Research takeaways (timeboxed)

**How Dune sells scale** (Villeneuve, Greig Fraser, Patrice Vermette, DNEG's Paul Lambert; interviews and breakdowns):
- *A small known thing against a vast form.* The ornithopter or a person is a speck against a dune or a ship. Ours:
  the mark (and later the monoliths) against the planet; from orbit, the glowing coastlines are the "city lights"
  that tell you how big a continent is.
- *Never show the whole object.* The planet's limb always runs off the frame edges; the disc is never framed whole
  (a whole planet in frame reads as a ball, a limb across the frame reads as a world).
- *Long lens, low angle, slow camera.* Long lenses compress distance so far forms loom over near ones; a low camera
  makes the horizon heavy. For us: narrow vertical FOV in the hero (big sun and mark, flat horizon), and slow, heavy
  camera moves (the world lead's spring).
- *Atmospheric perspective.* Contrast and saturation fall with distance through haze; DNEG layered haze deliberately
  to separate planes. Ours is physical: a real single + multiple scattering atmosphere, so the far sea fades into the
  horizon glow, and from orbit the limb is a thin bright line.
- *Restrained palette, one accent.* Dune is sand and sky with very little colour; the eye reads the one saturated thing
  as important. Ours: near-black space and sea, bone, and Ember heat; Quench only for the cold (the thin limb line,
  airglow, starlight).
- *Hard light, long shadows, silhouettes.* A low sun rakes across relief (terminator), forms go to silhouette against
  the glow.
- *Detail that keeps resolving.* Miniatures and practical sets read huge because there is always finer detail than you
  expect. Ours: every surface field is footprint-filtered fbm whose octaves fade in exactly at the pixel size, so a
  closer camera always reveals new detail and a far one never aliases.

**Physically based sky** (Hillaire 2020 "A Scalable and Production Ready Sky and Atmosphere Rendering Technique";
Bruneton 2017; Sebastian Lague's atmosphere video): transmittance LUT (256x64, Bruneton's horizon-aware mapping),
multiple-scattering LUT (32x32, Hillaire's isotropic 2nd-order + geometric series), sky-view LUT (200x120, per frame at
the camera, non-linear around the horizon) for the sky and for reflections in the sea; a per-pixel march for views from
high up, its samples crowded around the ray's closest approach to the planet (the limb chord's middle), so a thin limb
is sampled where it is dense.

**Stars that read as real:** N(>F) ~ F^-1.5 (a uniform population) so few bright, many faint; blackbody colours with
only ~55% of their chroma (cameras and eyes see star colour faintly); every star an energy-conserving gaussian ~1 px
wide (no twinkle in vacuum, never blocky, never shimmering as the camera turns); a faint galactic band of unresolved
light with dust lanes, and denser faint stars along it.

**Image pipeline:** AgX (Sobotka) instead of ACES: it desaturates toward white as things get very bright (a blackbody
reads correctly: Ember to yellow-white), without ACES's hue skews of saturated oranges. Bloom as a Karis-averaged
13-tap mip chain with tent upsampling (Jimenez 2014), mixed in at a few percent (a lens's veil, not a glow effect).
Grain about 1.4 px across, strongest in the mid-tones. Triangular dither at 8 bits so the long dark gradients of the
sky never band.

## Decisions

- **Units: km; the planet radius is 2000 km**, the atmosphere 40 km thick (Rayleigh scale height 2.5 km, Mie 0.8 km).
  A small, dense-at-the-bottom atmosphere: the vertical optical depth is small (dark zenith with stars at dusk), the
  horizontal one large (a deep orange horizon at sunset). That is the hero Jacob described: "part of the sunset, but
  also fading into stars".
- **Air colour:** Rayleigh coefficients less steep than Earth's ([8.5, 14, 24]e-3/km at sea level): the dusk band reads
  steel blue (Quench) instead of Earth's saturated blue, and the dayside haze from orbit stays grey-cool, not blue. The
  aerosol absorbs blue (mieA [0.5, 2, 6]e-3), which turns the horizon orange.
- **The sun is a K-type star** (light ~5200 K; disc heart 5200 K, limb 2300 K): warmer than ours, so the world's light is
  slightly warm without a filter.
- **Hero light:** a sunset with the light at the horizon (sun elevation about -1 to +1 deg at the core's azimuth). The
  core (the mark's sphere emitter, drawn by `mark`) hangs above it; the sky's own disc is hidden in the hero
  (`uSunDisc` 0) so there is one sun on screen. A light 8 deg up gives a beige, washed sky in a physical model; a
  twilight light gives the orange band, the steel-blue band above it and stars at the top.
- **Planet from far out:** no crust, no cracks. Seas are smooth molten metal whose temperature is wound into eddies
  (a curl-like advection of the position, like sea-surface-temperature maps), dark slow water between glowing currents;
  black-sand continents with relief that only shows in raking light; a fine hot thread along every coast; airglow as a
  thin Quench line on the night limb; the night sea's glow lights its own air from below.

## Open / next
- Port into `lib/world/glsl/{sky,atmosphere,planet,sun,post}.glsl` once `lib/world/ARCHITECTURE.md` lands.
- Agree with `lava` on the hand-off from the far sea (planet.glsl) to the near sea (lava.glsl): same temperature field
  and colour ramp, blended by footprint.
- Perf: per-pixel march only where the camera is high; the sky-view LUT covers sky and reflections when low.

## In the engine (07:30-13:45 UTC)
- `lib/world/look.ts` + `glsl/{atmosphere,atmosphere-luts,sun,sky,planet,post}.glsl`, registered. LUTs are rendered by
  look's own programs into textures the engine's Uniforms own (no engine change).
- The post is neutral (`look.gain` 1); look's light is in its own radiance unit (`UNIT` 3: sky, sun, far planet,
  `look_sunLight`), so lava's and the mark's radiance mean the same thing.
- No sun disc (the mark draws the core). While the core is near (hero), the air is lit from its azimuth 1.5 deg over
  the horizon: warm glow down to the sea, a steel-blue band, stars. Far away the core is the star.
- Stars: sparse and faint, one-pixel points (story/QA: copy reads over them).
- Far field: `look_planetFarMod(r, s, m)` + `look_farMix(s)`; lava has the exact diff to blend into it (not merged by
  me: lava owns lava.glsl). Until then the planet from orbit is lava's near sea at one temperature.
- Not done: a sunrise-over-the-limb tune (the shore camera doesn't frame the limb on phones yet), a measured iPhone
  cost of the far field (~60-100 noise evaluations per planet pixel at orbit, fewer with footprint early-outs).
- Frames: `shots/engine-v2-hero.webp`, `shots/engine-v3-phone.webp`.
