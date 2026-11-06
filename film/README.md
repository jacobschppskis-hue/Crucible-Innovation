# film/: pre-rendered "foundry at night" imagery

Photoreal renders for crucibleinnovation.com, made in Blender/Cycles from Python (no .blend files: every scene is
fully defined in code, with fixed seeds). The web outputs live in `public/film/<name>/`; raw PNG renders are not
committed.

| file | what it makes |
| --- | --- |
| `common.py` | Cycles setup (AgX, OIDN, fixed seeds), a small node-graph DSL, Blackbody heat emission, lights, camera |
| `iron.py` | **iron**: the Thesis scene, 96 frames of a cast-iron surface heated from 293 K to 1811 K |
| `ingots.py` | **ingots**: one cast plaque per venture (`sites`, `verge`, `trellis`), three stills shot as a set |
| `ring.py` | **ring**: the Split Ring as a cast object, 96 frames that follow Ignition's scroll story, plus a hero still |
| `grade.py` | the house grade: warm highlights, blacks lifted to `#0d0d0b`, vignette to `#0d0d0b` at the edges |
| `encode.py` | raw PNGs → graded WebP frames/stills in `public/film/`, with per-sequence byte budgets |
| `fonts/` | Archivo ExtraBold (names) and Gelasio SemiBold (Verge's serif V), static instances of the Google Fonts variable fonts (OFL, licences alongside) |

## The house look

A foundry at night, shot on a macro lens. Near-black warm void graded to exactly the page colour at the edges; a warm
low key (~2000–2300 K) from the front like furnace glow, a faint cool fill from above, rims for the bevels; sand-cast
metal with grain, pores, roughness variation and oxide in the crevices; long lenses and shallow depth of field.

Heat is physical: emission is Cycles' Blackbody at a per-point temperature, and its strength follows Wien's law,
`exp(C2/Te − C2/T)` with `C2 = 22000 K` (`common.heat_emission`), normalised to an exposure temperature `Te`. So
nothing visibly glows below ~800 K, and Blackbody ~1400 K is Ember's exact hue (G/R 0.108 vs Ember's 0.105). AgX turns
bright, saturated reds salmon-pink, where a real camera clips them to yellow-white. `grade.py` pulls only bright,
desaturated warm pixels toward ~38° hue, so the hottest metal reads yellow-white (`#ffb347` territory) and Ember
orange mid-tones are untouched.

Edges: the vignette reaches `#0d0d0b` at ~1.5% inside the frame. After lossy WebP, >99% of edge pixels decode to
exactly `#0d0d0b` and the rest are within ±1.

## Re-rendering

Blender as a Python module (`bpy` 5.2, Cycles on CPU). With `B` = that Python and `R` = a scratch folder for raw frames:

```sh
$B film/iron.py   --frames keys --out $R/iron                        # 46 keyframes, 1600x900, 12 spp
$B film/ingots.py --variant sites,verge,trellis --samples 128 --out $R/ingots   # 2400x1500
$B film/ring.py   --frames 0-95 --samples 40 --out $R/ring            # 1200x1200
$B film/ring.py   --frames 0 --variant still --samples 160 --out $R/ring-still   # 2400x2400
python3 film/encode.py $R iron ingots ring                            # -> public/film/
```

Previews: add `--scale 0.25 --samples 8` (any frame list such as `0,40,70,95` works). All scripts accept
`--skip-existing`, so an interrupted run resumes. `iron.py` bakes its static surface fields once to
`$R/iron-fields/*.exr` (4 × 4096², about 4 minutes) and reuses them.

### Timings

Measured on a shared 4-core CPU machine while other agents' builds were running (load 4–20), so expect ±2×:

- iron: field bake ~4 min, once; 46 keyframes at 1600×900 / 12 spp in ~50 min (solid 40–130 s, melt 45–240 s each).
- ingots: 2400×1500 / 128 spp: sites 28 min, verge 15 min, trellis ~15 min.
- ring: 96 frames at 1200² / 40 spp in 40 min (~25 s each); the 2400² / 160 spp still in under 5 min.
- encode: ~2 min for iron, under a minute for the rest.

Not made: **pour** (the optional 4 s loop). A first draft read as a flat graphic rather than footage, and there
wasn't time to bring it up to the bar, so it was dropped rather than shipped weak.

## iron (Thesis)

Frame `i` is at `T = 293 + i/95 × 1518 K`, linear. The surface is sand-cast iron under an oxide crust crazed into
plates. Heat comes from below, so the iron under the hairline cracks is ~95 K hotter than the mean and the plates
are 175 → 95 K cooler. What you see:

| frames | T (K) | look |
| --- | --- | --- |
| 0–27 | 293–725 | cold grey sand-cast iron with black mill-scale patches, barely lit by the warm key |
| 28–45 | 740–1012 | the hairline cracks start to glow dull red (first visible ~frame 30) |
| 46–62 | 1028–1284 | Ember-orange seams, glow spreading into the plates, fine crazing appears |
| 63–76 | 1300–1507 | orange plates, seams going yellow-white |
| 77–88 | 1523–1700 | it melts: the plates shrink to floating crust islands outlined by bright fresh metal |
| 89–95 | 1716–1811 | liquid iron with slow flowing motion, welling hot filaments, marbled slag, a sheen |

The camera's "auto exposure" (`exposure_temp`) is fixed while only the cracks glow. It then lets the seams brighten
from 0.3 to ~1.0, and once the iron is liquid it exposes for the melt. Camera: 105 mm at f/5.6, fixed position, with
a slow 1.0 → 1.32× zoom as the push-in. Because the camera only zooms, every frame is an exact scale of its
neighbours. Only the keyframes in `iron.KEYS` are rendered: every third frame of the solid phase, plus every melt
frame. `encode.py` synthesises the solid-phase in-betweens by rescaling the two neighbouring keyframes to the
in-between zoom and cross-blending them. Nothing moves in that phase except a smooth ~16 K/frame temperature step.

Outputs: `public/film/iron/1600/000–095.webp`, `public/film/iron/800/…` (budgets 3.5 MB and 1.2 MB),
`poster-1600.webp` and `poster-800.webp` (frame 70).

## ingots (foundry floor): real-time 3D now

The ingots are no longer rendered in Cycles. They are real-time 3D objects (`lib/gl3d/ingots.ts`, shown by
`components/IngotScene.tsx` and `lib/gl3d/ingotScene.ts`), freestanding on the page's liquid. `ingots.py` is kept only
as the old reference. `public/film/ingots/<slug>-{600,1200,2400}.webp` are now the **fallback stills** (reduced motion,
no JS, no WebGL): transparent WebP captures of the same 3D ingots, square-on with the slight constant tilt
(`lib/gl3d/ingotPose.ts`), made by `node scripts/ingot-stills.mjs` (Playwright + swiftshader if there is no GPU).
Then `node scripts/venture-og.mjs` rebuilds the share images `public/og/<slug>.jpg` from them.

## ring (home page scroll story)

Exact `lib/splitRing.ts` geometry at 1 SVG unit = 1 mm:

- arcs: bevelled annulus sectors, including the run-on under the end pixels
- pixels: 18 bevelled 3 mm cubes
- core: a domed molten core, r 4.5

Frame 0 is front-on through a 3750 mm lens at 10 m (orthographic to within 0.1 px). The 1200² frame spans exactly
the viewBox `-16 -16 96 96`, so frame 0 overlays the SVG. This was checked by drawing the SVG outlines over it: they
agree within ~1 px. The frame is `round(p × 95)`, where `p` is Ignition's pin progress. The pieces move with
Ignition's own formulas (`sm`, `sh`, `core`, `flare` in `components/Ignition.tsx`), and the CSS pixel scatter is
reused as 3D drift and tumble.

| frames | p | beat (page copy) | what the film shows |
| --- | --- | --- | --- |
| 0–6 | 0–0.06 | headline on screen | the mark at rest, front-on, aligned with the SVG |
| 7–21 | 0.07–0.22 | headline parts | camera eases off-axis (≤ 9° yaw, 5.5° pitch) and in; core goes out (15–19) |
| 18–28 | 0.19–0.29 | "Not the person." (t1 in 20–25, held to 34) | the machine half scatters, pixel by pixel: right, toward the lens, tumbling |
| 28–41 | 0.29–0.43 | "Not the person." (t1 out 35–39) | pixels held apart; core dark, crusted |
| 42–51 | 0.44–0.54 | "Not the model." (t2 in 44–49) | pixels fly home while the arcs slide left and back into depth |
| 51–61 | 0.54–0.64 | "Not the model." (held to 57, out 58–62) | arcs held away |
| 62–69 | 0.65–0.73 | — | the arcs return; the mark is whole again |
| 67–76 | 0.71–0.80 | "Neither, alone." (t3 in 71–79) | the core re-ignites |
| 67–84 | 0.71–0.88 | "Neither, alone." | flare: core to ~1830 K, peak at frame 73, lighting the inner ring; it settles to Ember by 84 |
| 77–88 | 0.81–0.93 | | camera eases back to front-on |
| 89–95 | 0.94–1 | "Neither, alone." held | at rest, front-on, aligned with the SVG again (core glowing) |

Outputs: `public/film/ring/1200/000–095.webp` and `public/film/ring/600/…` (budgets 3 MB and 1 MB), plus
`public/film/ring/still-2400.webp` (frame 0 at 2400², 160 spp).
