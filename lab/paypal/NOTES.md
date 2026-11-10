# PayPal beat: notes (role `paypal`)

## V3 (Nov 10, overnight): made of the planet's own material — current
The reviewer's verdict on V2: "map pins on a game globe", a camera static for two-thirds of the pin, a streak through
the PayPal label on desktop. Jacob's own warning: it "is very easy for you to mess up. It ends up looking very dumb, it
doesn't fit with the website, and it doesn't fit with the look of the planet." So the idea stays (one source, six
sparks, six places, the captions in order) and every part of the execution is now the planet's material:

- **Temperature, not sprites.** Everything on the sea is Kelvin added through `SeaMod.heat`; look's own Planck curve
  turns it into light. A place is a spring (hot core, cooling pool), the broad ring of heat its landing sends out
  (it fades in ~0.15 of the pin) and a river. PayPal is the same thing, bigger and hotter, and it cools once it has
  given everything away ("long after PayPal itself was gone"). At the end all of it cools back to the planet's look.
- **The new rivers really join look's.** `lookField()` is look's river field (planet.glsl `look_seaTemp`) on the CPU:
  the same hash, value noise, meander and 3 octaves. `joinRiver()` walks from a point ahead of each place (Newton steps
  on the field) to the nearest of look's rivers, keeps new rivers between 0.075 and 0.3 rad long, and then FOLLOWS that
  meeting point every frame as look's rivers drift (continuous; it only picks a new one while the river is not showing).
  The river is drawn analytically (a meander between the two ends, distance from the centre line in closed form: no
  loops, no texture), finer than look's rivers at the spring and their width at the confluence, where its own heat
  tapers so two rivers do not add up to a white knot. **If look changes its river field, change `lookField` too.**
  The drift is read off planet.glsl's own text (`LOOK_DRIFT`: 0.003 while look_seaTemp advects the field by uTime,
  0 once the network stands still, which the planet role's Nov 10 branch does), so that one change needs nothing here.
  `PAYPAL_HEAT` (GLSL const, 1.0) scales every kelvin the beat adds: the place to rebalance if look's sea gets hotter.
- **The vent gives itself away.** It opens the scene 2.2x the size of a spring and every throw takes some of it; by
  the heading it is no bigger than the six, and then it cools ("long after PayPal itself was gone").
- **Life at rest:** slow pulses of hotter metal run down every new river, the vent and springs breathe a few percent,
  the beads shimmer; a bead in the air lights the sea under it (inverse square). Two frames a second apart differ in
  ~19% of their pixels.
- **Throws seen side-on.** A throw straight away from the camera is a straight line however high it goes (V2's
  "beam"). The vent now sits to one side and throws across the frame, so every arc reads as an arc; height shows only
  where the surface is seen at an angle (the far half of the planet), which is where the long throws go. SpaceX peaks
  above the limb, against the black sky, below the caption. Tails are short (they cool in ~0.1 of the pin), thick and
  yellow by the bead and a thin dull-red thread behind: a thrown bead, not a line drawn to a company. Each bead lights
  the sea under it (inverse square), which is what tells the eye how high it is.
- **Names are annotations.** 13 px Archivo 560 at the end of a 1 px bone hairline with a tick, sides `l r u d`. Each
  place lists the sides no throw crosses (`labP` / `labD`); while a name is not showing yet the module picks, of
  those, the side that lies darkest (`|lookField|` under the text, and not on the place's own river).
- **Camera.** `beatChannels()`: constant-speed orbital drift (s) and push (h, log) through the pin, eased over its
  first and last 7%; the pitch follows so the limb keeps its line (phones: 35% -> 30% of the frame). The module's keys
  cover f 0.1-0.9 only (`MOVE`): before and after, each neighbour's ONE eased segment spans its 1-viewport gap plus a
  tenth of the pin (the camera is still arriving under the first caption and already leaving under the last one),
  which is far gentler than a 1-viewport lurch up to orbit and never stops dead at the pin's edge. Wide screens bank
  7 degrees (the limb rises to the right, captions have the sky on the left); the roll comes and goes inside the move.
  `quiet` 0.5 in these keys: look's rivers at about half their radiance, so the new sources are what burns.
- **Pin** 5.2 viewports (PayPal.css overrides World.css's 4.2). Timeline (p): vent warms 0-0.05; throws 0.10 0.135
  0.17 0.205 (landing 0.23-0.335); SpaceX 0.385 -> 0.575, Tesla 0.47 -> 0.58; heading 0.616-0.868; last line and the
  cooling 0.885-1.
- **Layout tool:** `lab/paypal/stage.html?ppall` draws every throw whole and every name, to check that no arc crosses
  a name, a caption or the heading. Sites are screen targets at `REF_P` (0.74) cast onto the sphere, per layout.
- `modules.ts`: the `paypal` entry takes all of the module's keys again (V2 filtered them to f >= 0.4).

Still weak / next: the first frame (the lone vent) is plain; the springs are small from orbit on phones; where look's
rivers happen to bunch (they drift) the lower part of the phone frame gets busy; nothing shows the network itself
glowing hotter downstream of a confluence (it would need look's field per pixel: ~9 noise taps).

---
# Earlier rounds (history)

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
