# Role: look (look development)

You make it look like film. Jacob: "These need to be detailed renders that actually look good, because if it's low
quality and it looks animated (like it looks like something in a video game), it doesn't work. It ruins the whole
aesthetic." And: "It should feel cosmic. It should feel huge."

## Research first (≤30 min, write takeaways in `lab/look/NOTES.md`)
- How Dune (Villeneuve, Greig Fraser, DNEG) sells scale: tiny human-scale reference objects against vast forms, low
  camera angles and long lenses, atmospheric perspective (haze layers, contrast falling off with distance), restrained
  palettes with one hot accent, slow camera, fine surface detail that keeps resolving as you approach, hard light
  sources, silhouettes. Also how practical/miniature work reads as massive (detail density, depth of field choices).
- Real-time physically based atmospheres (Bruneton, Hillaire 2020 sky-view/transmittance LUTs, Sebastian Lague's
  planet atmosphere), planet rendering from orbit (limb brightening, terminator, airglow, the thin blue/amber band of an
  atmosphere seen edge-on), starfields that read as real (magnitude distribution, colour temperature, no twinkle in
  vacuum, a faint galaxy band), filmic tone mapping (AgX/ACES), bloom/glare that is physically plausible.

## Deliver (in `lib/world/glsl/{sky,atmosphere,planet,sun,post}.glsl` + `lib/world/look.ts`)
- A thin atmosphere: visible as a sunset band when low over the sea (Continuum's hero: part of the sunset, fading up into
  stars), and from orbit only as a thin glowing line on the limb (Jacob: "lower down you can see the atmosphere, whereas if
  you zoom out, you see less of it").
- The planet at cosmic scale: the molten sea and dark lands/black sand seen from far out must stay detailed and
  believable (no mush, no tiling, no aliasing), with a clean terminator and night side where the lava glows.
- The sun = the mark's core: a believable star-like light (the `mark` role draws the mark around it; agree the sun's
  angular size and colour with them).
- The image pipeline: HDR, a filmic tone curve, physically plausible bloom, subtle grain, dithering (no banding), colour
  grading that keeps the brand (Ember the only hot accent, Quench only for cold).
- Prove it on phone first: 390×844 frames at the quality step an iPhone would run, then 1440×900. Commit frame sheets.
- If real-time cannot reach film quality somewhere, you may pre-render (offline, high sample counts, our own shaders or
  anything you can run here, e.g. Blender/Cycles via `pip install bpy` if it works) as layers or scroll-scrubbed
  sequences, but only if the hand-off to real-time is invisible and it stays light on phones. Decide with evidence
  (side-by-side frames) and tell the coordinator.
