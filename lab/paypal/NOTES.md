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

## Technical plan
- `lib/world/paypal.ts` (main thread, DOM-free): the beat as pure functions of p: `sites` (bearing, range, launch,
  loft), `arcPos(site, u)` (great circle in angle, parabola in height = ballistic with constant horizontal speed;
  apex = k·range, flight time ∝ √range), `vent(p)`, `trail(site, p, age)` (temperature/intensity by age:
  K = 900 + 1350·e^(-age/τhot), train fades with τtrain and drifts with a slow wind wobble driven by the clock, so at
  rest it is alive but the shape is a pure function of p). `update(frame)` builds the ribbon vertex buffer (screen-space
  strips with a Gaussian cross-profile, hairline core ≥ 1.3 device px with intensity scaled down when widened so the
  energy holds, mirrored copies for the reflection in the lava, occlusion by the planet tested per vertex) and fills
  the uniforms for the lava (7 places: dir, heat, age, flash, seed; 7 head lights).
- `lib/world/glsl/paypal.glsl`: `paypalEmit(n, P)` called by the lava/planet shader for the places (core + halo +
  flows, impact flash, a faint heat ripple) and `paypalLight(P, n, V)` for the embers' light on the glossy surface;
  the ribbon program (additive HDR into the scene buffer before bloom/tone map). If the composer has no extra-pass hook,
  I'll ask `world` for one ("draw additive geometry into the HDR target before post").
- `components/world/PayPalBeat.tsx`: the section (static, readable HTML: heading, the five captions as a real
  paragraph list for no-JS/reduced motion, the seven names), with `data-*` the engine reads; captions cross-fade by p;
  labels positioned from projected world positions each frame (one writer, transform only).
- Light version (reduced motion / no WebGL): a still from our renderer at p = 0.86 (six lights + PayPal) with the
  captions as plain paragraphs.
- Physics notes (research): lava bombs leave at unequal angles and speeds, one goes clearly long; head 2200-2500 K,
  trail 1450 → 900 K; tumble wobble ±15% at ~0.4 s; landing flash ~100 ms then the place ignites over 0.5-1.5 s;
  bloom only above 1.0, filmic curve so hot cores go white instead of clipping; no lens flares, no sparkle stars, no
  hue that is not blackbody; the night side nearly black.

## Decisions
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
