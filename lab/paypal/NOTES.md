# PayPal beat: notes (role `paypal`)

## The idea
Seen from high over the night side of the molten planet, PayPal is one hot vent. eBay buys it, the pressure builds, and
it erupts: four molten embers are thrown on real ballistic arcs over the planet's curve, the way a long exposure of
Stromboli shows lava bombs. Each one cools in flight from a white-gold head to a red trail that drifts and fades, lands
with a small flash, and lights a new place that grows lava flows like a city seen from orbit. Those places are YouTube,
LinkedIn, Yelp and Palantir. Then Elon's share goes up in one high throw that clears the atmosphere (SpaceX), and a
later, shorter one lands as Tesla. The camera rises as they spread, which is where the scale comes from. Six lights now
burn on the dark side while PayPal's vent cools to almost nothing: "long after PayPal itself was gone".

No channels, no rings, no diagram, no outlines. Trails leave nothing behind (each train fades within ~0.2 of the beat
after landing); only the lit places stay, and they stay in the world as the journey moves on.

## Storyboard (beat progress p, 0 to 1; pinned ~600svh on phones, ~500vh on desktop)
Frames: `shots/v0-phone-storyboard.webp` (p = .05 .20 .27 .34 .42 .53 .64 .78 .93), `shots/v0-desk-storyboard.webp`
(p = .20 .34 .53 .93). Prototype: `lab/paypal/proto.html?p=<0..1>&t=<s>` (scroll it, or fix p).

| p | Picture | Caption (top, in the sky) |
|---|---|---|
| 0.00-0.08 | Night side from high orbit, limb with a thin atmosphere across the upper third, stars above. PayPal: one small hot vent, label above it. | "In 2002, eBay bought PayPal." (0.02-0.215) |
| 0.08-0.23 | The vent swells: core whiter, a wider warm halo (pressure). | same |
| 0.23-0.26 | Eruption: a brief flash, four embers leave a split second apart, unequal angles and speeds. PayPal label dips out under the burst. | "After the sale, its people went on to found YouTube, LinkedIn, Yelp and Palantir." (0.235-0.455) |
| 0.26-0.40 | Four arcs over the curve: hot heads, trails cooling gold, orange, red, the old train widening and drifting. Their light is reflected faintly in the glossy lava. Camera starts rising. | same |
| 0.36-0.42 | Landings one by one: a tiny flash, a faint heat ripple, the place lights up (core + 3-5 flows growing), its name fades in above it. Trains fade out. | same |
| 0.485-0.62 | SpaceX: one high throw that leaves the atmosphere and comes down far away, near the limb. | "Elon used much of his share to fund SpaceX, and later to invest in Tesla." (0.475-0.70) |
| 0.61-0.70 | Tesla: a later, shorter throw. | same |
| 0.72-0.86 | Camera at its highest: six lights and PayPal on the dark planet, nothing moving but their shimmer. | "So much came out of a single company." (display size, 0.715-0.855) |
| 0.86-1.00 | PayPal's vent cools to a dull ember, its label dims; the six stay lit. Hands over to the next place. | "Not by luck. They found each other early, and kept backing one another long after PayPal itself was gone." (0.865-1) |

Caption copy is Jacob's text, shortened; every fact is in `data/story.ts` (eBay 2002; YouTube, LinkedIn, Yelp,
Palantir; "much of his share" for SpaceX, "later" Tesla; "not luck", "found each other early", "continued to back one
another long after PayPal itself was gone"). The last line sets up his breakout sentence in the chapter.

## What v0 shows and what is still wrong (to fix next)
- Works: the eruption fan reads like a long-exposure photo, not particles; the cooling trail colour; the places as
  small hot cores; captions in the quiet sky; labels on the landings.
- SpaceX reads as a straight beam (it flies almost directly away from the camera): give it a lateral bearing so the
  high arc is seen side-on and visibly clears the atmosphere and curves over the limb.
- Phone composition: the lower half of the planet is empty at the end and labels near the limb crowd (LinkedIn and
  SpaceX touch). Next: landings laid out in screen space per aspect (cast back onto the sphere, like Airless) with a
  label-collision pass; camera pull-back bigger so the curvature grows (the scale reveal).
- Landed places too small on phone; they need the flows to read (3-5 lobes, warm 1800-2500 K, squashed toward the limb).
- Trail cores still a little fat when near the camera: hairline core in px, train width in world units.
- The planet, atmosphere, stars and tone curve here are stand-ins; in the build they come from `look`/`lava`.

## v3 (13:50 UTC, on the real lava and look) — current
Frames: `shots/v3-engine-phone.webp`, `shots/v3-engine-desk.webp` (the real engine, `lab/paypal/stage.html`).
- Opens low and far by the vent (the Stromboli viewpoint) with the caption in the sky: the sea over the vent swells
  into a smooth dome (`SeaMod.g`, shading only, no glowing ring), the burst sends one wave across the sea, and four
  hair-thin throws tower into the stars. Then the camera climbs to orbit (log-even) while they cross the planet; the
  rise ends (f 0.37) before the first landing, so the names never appear at a moving frame edge.
- The module owns its camera (`keys: paypalKeys`, WorldModule.keys). The journey's `s` must never run backwards, so the
  camera keeps a fixed distance behind the vent and only climbs; PayPal is at 34 deg so the first key follows story's
  last (deg 12). A cooler night sea under the beat via `lava.heat` 0.16 → 0.07 in these keys.
- Bombs ~2 m, trains widen to ~10 m: thin and clean up close, held at >= ~1.2 render px from orbit (energy kept).
- Decided: the coordinator's 07:13 notes (planetary scale, long thin arcs, staggered launches, SpaceX the one high
  throw that curves back, places that grow and stay, readable names, PayPal cooling) are all in v3.
- Open: the night limb is nearly invisible from orbit (look's); places are kept small on purpose.

## How it is built (in the world engine, lib/world/ARCHITECTURE.md)
- `lib/world/paypal.ts` is the module (registered in `modules.ts`). Everything is a pure function of
  `p = frame.at('paypal')`; the clock only adds the heads' flicker and the trains' drift.
- `sea` hook: `paypal_places(q)` adds the seven places' heat (core, halo, 4 soft meandering flows that grow after the
  landing, a landing flash, a faint heat ripple) as emission on the lava. Seven `vec4` pairs of uniforms.
- `over` hook: the throws. The CPU samples each throw's path (dense at the head, sparse in the old train), with
  temperature, intensity and half-width per point, and packs them into a 20x64 RGBA32F texture in 8-segment chunks,
  each with a tight screen box (`paypal_uBox[64]`). A pixel reads only the chunks whose box it is in, takes the
  ray-segment closest approach, a gaussian cross-section in px (min ~1.2 render px; a widened line keeps its energy)
  and the brightest point per throw (no double counting at joints), depth-tested by `h.t` so the limb hides what is
  behind it. Spatter: 2 short sparks at each eruption, 4 at each landing, gone in ~0.02 of p.
- `after`: caption opacity (one at a time) and the names' positions (`frame.project` of the places) on the section's
  own DOM. `components/world/PayPal.tsx` is static markup; copy in `data/home.ts` (`paypal`).
- Camera: `paypalKeys(R)` (journey keys sampled from `beatCamera`), to be spliced in place of the journey's two paypal
  keys by `world`. Lab: `lab/paypal/stage.html` (esbuild bundle of the real engine with these keys;
  `node lab/paypal/stage-build.mjs`, frames with `node lab/paypal/shoot-stage.mjs phone|desk f1,f2 outDir`).
- Static (no JS / no WebGL): the five steps read in order as text; the world's still look behind.

## Decisions
- PayPal sits at 40 deg round the journey's circle (night side: the sun is at -87 deg).
- Desktop end frame: lens 48 deg, orbit ~0.34 R so the heading has sky above the limb.
- Ballistic eruption (Stromboli long exposure) over meteors or fireworks: it is lava, it starts at the vent, and the
  split into many arcs from one source is exactly the story. Fireworks bursts were rejected as cheap.
- SpaceX is the throw that leaves the atmosphere; nothing more literal (no rockets).
- PayPal cools at the end because his text says the group kept backing each other "long after PayPal itself was gone".
- No connecting lines between the companies ("no stray lines"); the shared origin is shown by the eruption itself.

## References (research, ~20 min)
Stromboli long exposures and bomb ejection speeds (UNIGE 30365, stromboli.net photo technique); USGS lava colour vs
temperature; meteor head/trail spectra and persistent trains (arXiv 2007.04041); ISS "Looking down on a shooting star";
Hayabusa and ATV-1 re-entry (fragments differ in brightness and lifetime); ISS city lights (core, filaments, soft
falloff, foreshortened at the limb); SideFX "Applied Houdini Particles III" (sparks: curved sub-frame blur, glow in
comp); GitHub globe (what reads cheap: equal arcs, constant-colour tubes, looping).
