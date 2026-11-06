# film/: Blender reference imagery and the house look

The site's 3D is now real-time (`lib/gl3d/`, procedural materials; see `CLAUDE.md`). Nothing in `public/film/` comes from these Blender scripts any more: `public/film/ingots/` holds transparent stills captured from our own renderer by `node scripts/ingot-stills.mjs` (square-on, constant slight tilt from `lib/gl3d/ingotPose.ts`; sizes `<slug>-{600,1200,2400}.webp`), and `node scripts/venture-og.mjs` builds `public/og/<slug>.jpg` from them. They are the static version for reduced motion, no JS and no WebGL. The scripts here are kept as the look reference (Blender/Cycles from Python, no .blend files, fixed seeds).

| file | what it is |
| --- | --- |
| `common.py` | Cycles setup (AgX, OIDN, fixed seeds), a small node-graph DSL, Blackbody heat emission, lights, camera |
| `ingots.py` | one cast plaque per venture (`sites`, `verge`, `trellis`), the original reference for `lib/gl3d/ingots.ts` |
| `iron.py`, `ring.py` | older scenes (heated iron, the Split Ring as a cast object); no longer used by the site |
| `grade.py` | the house grade: warm highlights, blacks lifted to `#0d0d0b`, vignette |
| `encode.py` | raw PNGs to graded WebP |
| `fonts/` | Archivo ExtraBold (names) and Gelasio SemiBold (Verge's serif V), static instances (OFL, licences alongside) |

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

Blender as a Python module (`bpy` 5.2, Cycles on CPU), `R` = a scratch folder for raw frames:

```sh
$B film/ingots.py --variant sites,verge,trellis --samples 128 --out $R/ingots   # 2400x1500
python3 film/encode.py $R ingots
```

Previews: add `--scale 0.25 --samples 8`. Scripts accept `--skip-existing`. Do not copy the output over `public/film/ingots/`: those files are the 3D captures.
