# Your workstream: the venture ingots

Branch: `claude/inspiring-allen-sz5kjl-ingots`

## Jacob's words (verbatim)
- "I want you to make the Crucible site's ingot glow slightly and fix the logo on it so that there aren't the three pixels
  stacked directly on top of each other. It's not like it's a C, it's like it's a half-circle instead of slightly
  elongated edges."
- "For the Verge and Trellis ingots, I want you to remove the caking on them so that it's more of a seamless,
  uninterrupted glow. Right now it looks kind of dirty with the outlines over it, so I want you to remove that."
- "I want you to make it more interesting and more properly incorporated with the page, because right now it seems just
  slightly out of place. I also want them to have slightly more haptic feedback. Also, make the 'About Verge' thing more
  obvious to click, or if you hover over the ingot, it displays the text or something. Figure out how to incorporate
  that on iPhone."
- "Ways to make the ingots more interesting and fit with the page more."

## Context
Read CLAUDE.md "3D" (the ingots part) first. `lib/gl3d/ingots.ts` (relief map / stamp), `materials.ts` ('bar' = Crucible
Sites cooled bone metal, 'ingot' = the hot bars with a blackbody ramp and a drifting dark crust with glowing cracks),
`ingotPose.ts`, `ingotScene.ts`, `ingotRunner.ts`, `ingotWorker.ts`, `ingotStage.ts`, `components/IngotScene.tsx`,
`components/Ventures.tsx/.css` (home: pinned sideways track), `/ventures` and `/ventures/[slug]` pages
(`components/VenturePages.css`). Stills for the light tier come from `node scripts/ingot-stills.mjs` and the share images
from `node scripts/venture-og.mjs`.

## What to do
1. **Crucible Sites bar**: a slight, believable glow (residual warmth: e.g. a faint warm light from inside the stamp cut
   and along the fillets, a soft bloom into the liquid around it), still clearly the cooled bone bar. The stamp now uses
   the new Split Ring (arcs that are true half circles ending on the core's centre line, 14 squares on the circles): make
   sure it reads cleanly at every size it's shown (relief resolution, cut depth, AA): no stacked pixels, the arcs a clean
   half circle.
2. **Verge and Trellis**: remove the crust/caking and the dark outlines entirely. A seamless, uninterrupted molten glow:
   a smooth blackbody gradient with slow living movement (convection, a gentle shimmer), a clean specular, a hot rim; the
   name must still read (cut slightly deeper/darker, or brighter, whichever looks best).
3. **Incorporate them with the page**: they are objects on the page's liquid. Make that felt: a glow pool / reflection
   on the liquid under the hot bars (drawn in the ingot's own transparent canvas or by sending a light to the liquid only
   if you coordinate cleanly; `lib/liquid/*` is owned by another session, so prefer your own canvas), ripples where they
   sit when something rocks them, heat shimmer above the hot ones, layout and type that relate to the bar. Your design
   call: make the section feel designed around them, not objects pasted on a black page. Make the venture text more
   interesting too (it's "just white on a black background"): accents, hierarchy, relation to the bar; within the brand
   rules (no gradient text, no second display face; Ember means hot).
4. **More haptic feedback**: the bars respond more to the visitor: hover/press makes the bar dip and rock toward the
   pointer with a ripple, a tap bobs it; on phones a light real vibration where the platform allows it (Android
   `navigator.vibrate`; on iOS Safari there is no vibrate API: research the iOS 18+ `<input type="checkbox" switch>`
   haptic behaviour and use it only if it is reliable and accessible; otherwise make the visual/physical response carry it).
5. **Clear affordance to open each venture**: make the whole bar the link target (cursor, focus ring, hover reveals a
   clear "About Verge" / "See Crucible Sites" label near the bar), and on iPhone make it obvious without hover (e.g. the
   label always visible on touch, the bar tappable, a press state). One link per venture for screen readers.
6. Regenerate the stills and share images (`scripts/ingot-stills.mjs`, `scripts/venture-og.mjs`) after the look is final,
   and keep the light tier (reduced motion / no WebGL) looking as good.

## Files you own
`lib/gl3d/ingots.ts`, `ingotPose.ts`, `ingotScene.ts`, `ingotRunner.ts`, `ingotWorker.ts`, `ingotStage.ts`,
`lib/gl3d/materials.ts` (the 'bar' and 'ingot' parts ONLY; 'cast'/'core'/'hot' belong to the logo session),
`components/IngotScene.tsx`, `components/Ventures.tsx`, `components/Ventures.css`, `components/VenturePages.css`,
`app/ventures/**`, `scripts/ingot-stills.mjs`, `scripts/venture-og.mjs`, `public/film/ingots/*`, `public/og/*`, the
ventures parts of the tests. Don't touch `lib/liquid/*` (another session), the logo, the story or the Thesis.

## Verify (evidence in your report)
The ventures track at 1440x900 and 390x844 (several scroll positions), 2x crops of each bar's stamp, a hover/press
sequence on desktop and a tap sequence with touch emulation, the venture pages, the stills.
