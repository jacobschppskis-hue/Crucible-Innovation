# story: the words in the world (notes and decisions)

Role: the founders' chapters (Jacob, then Charlie) with the CRT "No signal" tubes, the Thesis heat (293 K → 1811 K),
how every piece of text sits in the world (no scrims), and the footer/shore that hands over to the loop.

## Decisions (07:20 UTC)
1. **PayPal sits inside Jacob's chapter**, right after the paragraph that tells it (paragraph 2), and the chapter resumes
   with paragraph 3: "That group came together mostly in their twenties. *I want to know what happens when a group like
   it comes together earlier.*" The display break-out lands straight after the six sparks: the scene asks the question,
   his sentence answers it. `Chapter` takes an `interlude` slot after paragraph index 1; the PayPal component (paypal
   role) is rendered there. Words untouched.
2. **Reading happens on the night side, low.** The camera glides low over a calm, cooled stretch of the night sea, pitched
   up so the horizon sits low in frame (phones ~76% down, desktop ~68%): the type has the star field to itself and only
   the last lines of a screen cross the sea. The night sea under text stays dim (relative luminance ≤ ~0.08 where text
   is; bone #E8E4D8 needs bg ≤ 0.13 for 4.5:1). Interaction wakes still pass under (they are brief Ember lines).
3. **Legibility by composition only.** No scrim, mask, halo, text-shadow, darkened box. If a frame fails AA, the fix is a
   camera/place change (horizon lower, sea cooler there), never a backing.
4. **Display type is reflected in the sea** (the one way text touches the world): display lines (break-out, thesis,
   the giant wordmark) are drawn once into a small atlas, their live screen rects go to the shader as uniforms, and the
   sea's reflection path looks them up as if they hung in the sky at their screen position. Bone type shows a broken,
   wave-distorted reflection in the night sea, in the molten iron of the Thesis, and under the wordmark at sunrise. The
   DOM text itself is never redrawn in GL.
5. **Thesis = the planet's sea heats.** Camera low, horizon around mid-frame, type in the sky, the sea below. At 293 K the
   sea is cold metal: a dark mirror of the stars (reads Quench, matching the readout). As it heats it glows from within
   through the Nov 2 domain-warped flow (smooth, glossy; no dark crust, no plates, no specks: cool areas are just cooler
   smooth metal), to flowing yellow-white metal at 1811 K pooled in the near sea, the type clear above. Readout colour:
   Quench at 293 K → bone → Ember at 1811 K.
6. **The shore/footer ends on the hero.** Contact and links read over the dark sky as the camera climbs toward the limb;
   the giant wordmark sits over the horizon as dawn starts, its reflection in the sea; then it scrolls off and the sun
   (the core) and the mark rise into exactly the hero frame: the loop point.

## Built so far (07:20-07:40 UTC)
- `components/world/{Story,Chapter,Thesis,Footer}.tsx` + `Story.css`, `Thesis.css`, `Footer.css`. Body copy is solid
  bone (88%), no dim reading state: the reading heat's dim words would fail AA wherever the glowing sea passes under
  them (the dim front sits in the bottom 15% of the screen, exactly where the horizon is). Progress is shown by the
  chapter's reading line instead (Ember while read, bone after).
- `lib/world/thesis.ts`: `setThesisHeat(k)` (the component) → `thesisHeat.k` (the world), and `THESIS_GLSL`
  `thesisEmission(p, dist, fp, k, t)`. Lab frames: `shots/thesis-heat-phone-proto.webp`, `shots/thesis-1811K-desk-proto.webp`.
  Cold metal is a mirror (F0 ~0.32 at 293 K → 0.04 molten) — to agree with `lava`.
- `lib/world/type.ts`: `[data-reflect]` lines → atlas (once) + live rects (per frame) → `typeAt(px, lod)`, with
  `typeProject(R, cam…)` for the sea's reflected ray. Verified in `lab/story/thesis.html` (cold sea mirrors the line).
  A reflection mirrors about the horizon, so it shows only for type standing close above the horizon: the footer
  wordmark (by design), the readout, the break-out when it crosses low. Type high in the sky reflects off screen.
- Lab tooling: `node lab/story/shoot.mjs <page> <out> k=…` (serves the repo, transpiles .ts on the fly, iPhone 15 + 1440).

## Open
- PayPal captions paraphrase Jacob's paragraph 2, which the scene follows. Accepted: Jacob asked for the beat to be
  explained more; the captions are short steps, the paragraph is his account (kept word for word).

## After JACOB.md (07:25 UTC)
- Footer: his one footer "like" is the glowing surf ("waves breaking on a shoreline, except glowing"). The shore place
  becomes a real shore: glowing surf on black sand under the giant wordmark, then the camera lifts over open sea into
  the hero frame (asked `world` who draws the surf).
- Quench: never ratified by Jacob. In my sections it is only the 293 K readout (cold data), nothing else.
- Thesis: smooth molten metal, no crust/cracks (tonight's "dirty" rule beats the Nov 2 cracks at cold): cold is a dark
  glossy mirror, not cracked metal.
- R3: "come up with some ideas to make the biography pages look better" → the chapters get the cinematic treatment
  (credits over a night landscape, the tube as the pinned partner, the break-out as the scene's answer).
