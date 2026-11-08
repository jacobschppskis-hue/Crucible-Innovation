# Your workstream: the founders' story (the PayPal tree, CRT portraits, the repeated line, the biography chapters)

Branch: `claude/inspiring-allen-sz5kjl-story`

## Jacob's words (verbatim)
- "Make the PayPal, YouTube, LinkedIn, Yelp, Palantir, SpaceX, Tesla tree a much better animation, because right now it
  looks half-finished and like it was made by an early GPT model on low effort. I want you to make it more seamless with
  less sharp lines, properly integrated with the page, so things don't just go away so quickly, and more refined so that
  it's more constant. Remove the jerkiness and sudden endings. Right now, it has spots where the lines below the Y of
  PayPal, it's just sitting there, the line. So either have it fade or come out of something, or do something more
  interesting that works better. You have creative control and you can use your own discretion."
- "Come up with some ideas to make the biography pages look better."
- "Remove the line that repeats where it says, 'I want to know what happens when a group like this comes together
  earlier.' I want that to only be there once."
- "For our portraits, I will input more original pictures of us, and this time, instead of converting it to ASCII art, I
  want you to convert it into a different kind of art called CRT." ... "I actually don't have any of the photos for you
  to put in, so just put in placeholders for now."
- Also (from the same message, about every scene): "there is no single component that is low effort, like the previous
  PayPal into its different companies ... those are just very low effort things that kind of fit with the theme
  theoretically, but visually, they're very boring and not interesting and not aesthetically pleasing."

## Context
`components/Story.tsx` + `Story.css`: "Why Crucible", one chapter per co-founder (Jacob first), the portrait pinned beside
the text on wide screens, the text warming as it's read (`HeatText`, `ReadingHeat`). Between Jacob's paragraphs, the
`SplitBeat`: a casting tree drawn in SVG + clipped text, scrubbed by `data-scroll="view"` (`--p`): metal poured into
"PayPal" runs down one straight sprue (a vertical bar under PayPal's middle, right below its "y") and out through six
straight gates into the six names, which then cool to bone. Problems: hard straight lines, a mould outline and a bone
sprue that just sit there, pieces that pop/end abruptly, nothing alive after the pour.
The repeated line: `data/story.ts` Jacob's paragraph 3 contains "I want to know what happens when a group like it comes
together earlier." and `pullQuote` repeats it as a big quote right after that paragraph.
Portraits today: ASCII (`public/team/*-bone.webp`, `scripts/bone-portraits.py`, `components/PortraitImg.tsx`,
`components/Builders.tsx` `Portrait`), used on `/` (Story) and `/sites` (Builders). `data/team.ts` has the team.

## What to do
1. **The PayPal beat, redone properly.** Your creative call; it must be seamless, refined, alive and part of the page's
   liquid world. Directions that fit (pick, combine or beat them): molten metal that pours out of PayPal itself (the "y"'s
   descender is a natural spout) as a smooth, viscous, rounded stream (no hard-edged bars: an SDF/metaball look with
   surface tension, highlights and a glow), splitting organically like a river delta into six runs that each fill a name
   as a casting; channels that drain and cool and then dissolve into the page's dark liquid (so nothing static is left
   sitting there), droplets that land with ripples in the page liquid (`lib/liquid/field.ts addSource(x, y, amp,
   {kind:'float'})` style API, read `field.ts` and `input.ts drop()`), names that keep a slow, faint living warmth
   instead of switching off; continuous, eased, scroll-scrubbed and reversible; no jerk at any scroll speed; no "sudden
   endings" (every piece finishes its motion and settles). Render with whatever gives the best quality: a small WebGL
   canvas (transparent, `renderer()` on the one clock `lib/liquid/loop.ts`, created near the viewport like the other GL
   scenes, quality steps, software GL cheap) with the names as real text on top, or refined SVG/CSS if you can make it as
   good. Keep: the facts and order from Jacob's paragraph (PayPal, then YouTube, LinkedIn, Yelp, Palantir, SpaceX,
   Tesla), the figure's `aria-label`, a beautiful finished static state for reduced motion / no JS, phone layout (390
   px) as good as desktop, nothing behind it that hides the liquid (no dark boxes: another session removes the liquid's
   text mask globally).
2. **The repeated line.** Show that sentence once. Do not edit Jacob's words: remove the separate pull quote and instead
   set that same sentence, in place inside paragraph 3, as the paragraph's display-size break-out (the paragraph flows
   into it and continues after), so it is read once, in order, and still gets the emphasis. Keep Charlie's closing
   statement treatment.
3. **CRT portraits (placeholders now).** Replace the ASCII portraits with CRT art: the look of an image shown on a
   cathode-ray-tube screen (phosphor dot/aperture-grille structure, scanlines, bloom, slight curvature/vignette, a little
   chroma at the edges), art-directed for this site (dark foundry at night; decide between a bone/amber monochrome
   phosphor and a full RGB mask by what looks best on the page; justify it). Build:
   - `scripts/crt-portraits.py`: source photo (kept OUT of git, e.g. `public/team/src/*.jpg` + .gitignore) -> committed
     CRT stills (`public/team/<name>-crt.webp`, plus sizes if useful). Document its usage in a header comment.
   - A live treatment in the page (a portrait "powers on" when it comes into view: the line, the expanding raster, the
     glow settling; a slow rolling scan band and faint flicker afterwards; reduced motion = the settled still), cheap
     (CSS/canvas; it can't add first-load JS weight beyond a little).
   - Placeholders until Jacob sends photos: no faces, nothing fake. E.g. the CRT showing a "no signal" state or a
     tasteful test card with the person's name, rendered through the same pipeline. Mark with `// TODO(jakob)`.
   - Update `components/PortraitImg.tsx`, `Portrait` in `components/Builders.tsx`, `data/story.ts` portrait paths
     (only the path field), `data/team.ts`, alt texts, and the tests that look for `img[alt^="ASCII portrait"]`
     (`tests/opening.spec.ts`, `tests/smoke.spec.ts`). Remove the ASCII files and script once nothing uses them.
   - Propose the new wording for the unslop rule "ASCII images, except the founders' portraits" in your report.
4. **The biography chapters.** Make them look better: you decide (typographic rhythm, the pinned portrait's relationship
   to the text, how the chapters open and hand over, how Charlie's chapter gets its own moment, motion that answers
   scroll everywhere). Implement the strong ideas; list the rest as proposals for Jacob in your report.

## Files you own
`components/Story.tsx`, `components/Story.css`, `components/HeatText.tsx` (if needed), `components/PortraitImg.tsx`,
`components/Builders.tsx` (Portrait), `data/story.ts` (structure/portrait fields only), `data/team.ts`, `public/team/*`,
`scripts/bone-portraits.py` -> `scripts/crt-portraits.py`, any new `lib/gl/*` file for the beat, and the portrait/story
parts of `tests/*.spec.ts`. Other sessions are changing `lib/liquid/*`, the logo, the ingots and the Thesis flames.

## Verify (evidence in your report)
A 16-24 frame scrub of the PayPal beat at 1440x900 and 390x844 (fixed scroll positions, clock stepped), a fast scroll
through it and back (no jerk, nothing left half-drawn), the finished static state (reduced motion), the CRT power-on
sequence, both chapters at both sizes.
