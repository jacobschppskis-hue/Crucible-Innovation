# Your workstream: the 3D logo's materials and the logo with its new geometry

Branch: `claude/inspiring-allen-sz5kjl-logo`

## Jacob's words (verbatim)
- "Remove the very dark marks from the ball so it's more smoothly modeled instead of being so markedly dirty looking in
  some areas."
- "Add more texture and dimension to the white lines and the pixels, so even though it's supposed to be glowing white
  hot, it should still have some definition, some reflectivity, some shininess, and variation in color and depth."
- (Already done in geometry at 0b6bc71, you verify it in 3D:) "There are too many squares, and on both iterations, there
  are three squares vertically aligned. They should be centered perfectly where they would be if it was a consistent
  circle." "Make the line slightly thicker ... and make it less so that it looks like the line continues past the
  center. It should have a visible break before the square on the opposite side of the very center of the glowing ball."

## What to do
1. **The core (the glowing ball, material 'core' in `lib/gl3d/materials.ts`).** Today it shows dark blotches/crust
   marks (look at a settled hero frame: brown-black patches on the orange sphere). Remove them. Model it smoothly: a hot
   orange sphere with a soft, believable gradient (hotter, brighter toward the centre facing you; deeper orange-red at the
   limb), gentle slow surface movement (convection shimmer) at most, a clean specular, a soft glow. Never dirty, never so
   bright that it reads as a flat sticker. Same look on load, through the scroll story and after.
2. **The arcs and squares (material 'cast', and 'hot' during the pour).** Give them definition and depth while they still
   read as the same light, near-white bone metal: real reflectivity (an environment reflection: the warm foundry below,
   a faint cool fill from above), a shininess that moves as pieces float and tilt, crisp bevel highlights, subtle ambient
   occlusion in the bevels and where faces meet, gentle colour variation (warmer on faces turned toward the core and the
   key light, cooler/greyer on faces turned away, slight per-piece variation), and fine sand-cast micro texture that
   catches the light. Think high-end product render of cast metal, not a flat white extrusion. Check at 2x crops: the
   bevel edges, the flat faces, the squares' faces. Check that the pour's white-hot phase still reads white-hot but with
   form (not blown-out flat white).
3. **Verify the new geometry everywhere the logo moves**: the pour (`lib/gl3d/pour.ts`, `?pourdebug` contact sheet, the
   ghost drawing `.ig-ghost` from `outlinePath`), the settled hero, the scroll story beats ("Not the person": the squares
   scatter; "Not the model": the arcs leave; "Neither, alone": everything fuses), the phone opening (every piece stays 14 px
   inside the screen: `fitA`/`fitS` in `logoScene.ts`), the reduced-motion SVG, the nav mark, the 404 cold ring, the
   floating (pieces ride the liquid; the cursor pushes them). Fix anything the new geometry broke or made look worse
   (e.g. trickle thickness vs the thicker band, extrusion depth/bevel proportions for a 3.6 band, the arcs' flat ends:
   make their bevels look intentional). The arcs now end exactly on the core's centre line: make sure the 3D render shows
   a clear, visible break between each arc's end and its first square from the hero camera angle too.
4. Keep the light tier, the worker/main-thread split, the one clock, quality steps and software-GL cost as they are
   (CLAUDE.md "3D"). Software GL must stay cheap.

## Files you own
`lib/gl3d/materials.ts` (the 'cast', 'core', 'hot' parts ONLY; 'ingot' and 'bar' belong to another session working on the
venture ingots: do not touch them), `lib/gl3d/logoRunner.ts`, `lib/gl3d/logoScene.ts`, `lib/gl3d/pour.ts`,
`lib/gl3d/pourGeo.ts`, `lib/gl3d/sceneWorker.ts`, the logo parts of `lib/gl3d/geometry.ts`, `components/Ignition.tsx`,
the `.ig*` rules in `app/globals.css`, `components/SplitRing.tsx`, `tests/opening.spec.ts`. If you must change
`lib/gl3d/core.ts` (shared with the ingots), keep it backward compatible and say so in your report.
Do not touch `lib/liquid/*` (another session is reworking the liquid) or the ingots.

## Verify (show your evidence in the report)
Settled hero at 1440x900 and 390x844 (`?liquid=full`, after `section.ig[data-settled]`), 2x crops of the core and of an
arc end + first square, the pour contact sheet, 6-8 frames through the scroll story, and the logo while a scripted cursor
drags across it. Compare before/after crops side by side.
