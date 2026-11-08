# Your workstream: restore the Thesis fire to the original

Branch: `claude/inspiring-allen-sz5kjl-fire`

## Jacob's words (verbatim)
"The fire at the bottom is terrible this run, absolutely terrible. Go back to how it was originally, exactly how it was
originally before we changed it to being the metal heating up, and before we made it this version, like the one before
that, and before that. That one was good."
And: "I do like the waves at the bottom that looks like waves breaking on a shoreline, except glowing." (That is the
footer furnace, `components/Furnace.tsx`, `FurnaceGL.tsx`, `lib/gl/furnaceGL.ts`: keep it exactly as it is.)

## History (git)
- `88d9f80` (Oct 26): Thesis with no GL.
- `a1ff430` (Oct 27) "the Thesis heats into molten iron": a CSS furnace glow rising from the floor with the temperature,
  and on the rich tier `lib/gl/molten.ts`: one fullscreen shader, domain-warped fbm on a blackbody ramp, "from cold to
  glowing cracks to flowing molten metal at 1811 K, pooled low so the type stays clear, cursor adds heat". Small changes
  up to `1980594` (Nov 2), the build Jacob calls the original and good ("the rising fluid flames from the Nov 2 build").
- `1926bad` (Nov 4): replaced by a rendered film of an iron bar melting ("the metal heating up").
- `80560c7` (Nov 6) onwards: flames brought back and reworked many times, ending in today's "streak-line fire" with
  tongues and puffs in the bottom 30% (`FLAME_SPAN`, `.thesis-gl`). That is "this version": the one he hates.

## What to do
1. Build `1980594` in a separate worktree (`git worktree add ../orig 1980594`, `npm ci`, `npm run build`, serve it on
   another port) and record its Thesis on `/?tier=rich` at 1440x900 and 390x844: 8+ heat levels across the pinned scroll
   (293 K .. 1811 K), each held for a short frame sequence so you see the motion, plus the cursor adding heat. That is the
   target, exactly: same look, coverage of the screen, height, colours, motion, speed, how it ramps with heat, the CSS
   furnace glow under it, how it meets the type. If `88d9f80`'s Thesis turns out to be what "originally" means instead,
   record it too and say which you matched and why in your report (default: `1980594`).
2. Restore it in today's architecture: the one clock (`onFrame` from `lib/liquid/loop.ts`, `renderer('thesis', ...)`,
   `done(t)`), `whenNear()` deferral, quality steps that lower resolution on slow frames and start low on software GL
   (`?liquid=full` keeps full), the `--gl` fade written from the clock (no CSS transitions for GL fades), the static CSS
   furnace light tier for reduced motion / no WebGL. Use `highp` (Apple GPUs run mediump as half floats; the footer
   lost its detail in Safari that way). The section background stays transparent over the page liquid; the canvas must
   be transparent where there is no heat. Keep today's Thesis copy and readout (293 K -> 1811 K); match the original's
   pinned scroll timing for the heat if it differs.
3. Compare old vs restored side by side at the same heat levels (contact sheets) until you can't tell them apart.
   Remove the streak-line fire code and anything only it used.
4. Update `tests/` that check the Thesis (`smoke.spec.ts`, `opening.spec.ts`: search "thesis", "FLAME", "molten").

## Files you own
`lib/gl/molten.ts`, `components/Thesis.tsx`, the `.thesis*` rules in `app/globals.css`, Thesis parts of the tests.
Do not touch the footer furnace, `lib/liquid/*`, the logo, the story or the ingots (other sessions).

## Verify (evidence in your report)
Old-vs-new contact sheets at matching heats, desktop and phone, and a recording with the cursor moving over it.
