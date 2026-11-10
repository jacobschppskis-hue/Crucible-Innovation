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

## Footer v1 (07:40 UTC, after world asked for ~2 more viewports before the seam)
- `shore` 2.4 screens: the contact block is pinned (sticky, centred) in the sunrise shot. One display line over it:
  "Already building something?" (Jacob's goal, finding the people already building things, turned into an invitation;
  no fact claimed, placed once). Not a sentence from his story: repeating one of his lines would be "the same sentence
  twice", which he dislikes.
- `dawn` 2.0 screens: the giant wordmark pinned over the day-side crossing; low over the sea at the end its reflection
  shows (type.ts, below 500 m). Then the loop copy of the hero comes up from below.
- Phones: links in two columns (Pages | Ventures, status under the name), founders full width, so the pinned block fits
  844 px. Frames: `shots/footer-phone-v1.webp`.

## Type reflections: off (07:45 UTC)
The coordinator's walk found the reflections reading as scrambled glyph noise (under the 293 K line, the story heading).
A softened version (coarser mip, five vertical taps, dimmer) turned the footer wordmark's reflection into a grey haze
band. Neither reads as a real reflection, and "off is better than glitchy", so the `type` module is unregistered and no
element carries `data-reflect` in my components. `lib/world/type.ts` stays (the atlas + sky-hook approach works
technically) in case a real-looking version is wanted later: it would need the lava's calm-surface normal and an
anisotropic (vertical) blur proportional to the wave slope variance, which is the lava module's information.

Wide screens now read at 20 px body / 28 px lead / 44rem measure (the coordinator found 18 px small at 1440).

## 13:45 UTC (after a worker restart)
- QA P1 fixed: without JS the Thesis lines stack at full opacity (pin + crossfade only under html[data-world]);
  `lab/story/nojs-check.mjs` verifies it on iPhone 15 and 1440.
- Thesis contrast by composition: `thesis` measures the bottom of the pinned type every frame (`thesis_uClear`) and the
  metal pools only below it; above, the sea stays cold dark metal. Frames: `shots/thesis-phone-v2.webp`.
- Story opening now sits on dark sky with the world's latest journey (9e8fce4); the CRT tube powers on in view.
- Open: the glowing surf under the footer wordmark (Jacob's footer like) is unassigned; not started this late without
  world's OK.

## The shore (14:45 UTC): Jacob's glowing surf, as world module `shore`
- Where: a black-sand beach across the travel line, 1200 units before the hero (land on the far side). From the hero
  (h 1.6, horizon ~140 units) anything lower than ~90 units at that range is below the horizon, so the hero is untouched.
- Camera (my keys for `shore` and `dawn`, via `module.keys`): high over the day side at dawn 0, down out of the sky by
  0.4, hanging ~75 units off the waterline at 22 m facing the land with the setting sun off to the right by 0.72-1.
  world's loop keys then pull back over open sea into the hero: verified frame by frame (`lab/story/glide.mjs`), the
  beach sinks away and the seam frame equals the hero.
- Surf (sea hook): crests run in (long back, steep face, shoaling), white-hot rolling lips only where they break, warm
  dark-red troughs, same lava material (heat + emit, `lava_planck`). Sand (hit/shade/env): a gentle beach to low dunes,
  black with a broad sheen, the surf's warm light on it; the swash runs up fast and drains slowly with a bright lip; the
  sand it leaves glows and cools; wet sand mirrors the sky. One wave clock for crests and swash.
- The wordmark sits in the upper third over dark sky (the dunes' skyline at ~43%, the surf under it).
- Frames: `shots/surf-phone-v1.webp` (one wave cycle on iPhone).

## V2: the Thesis rebuilt (Nov 8, 23:30 UTC)
Jacob: "after it gets black, when the temperature is rising from 293 to 1,811, there's the base part, and then only at
the front part of the planet, there's a bunch of stuff moving around, it just doesn't look good"; "Always make it so
that you can see the planet".

Options considered:
1. **The whole planet heats evenly (chosen).** One temperature offset for the whole sea through the lava's own
   material (SeaMod.heat): at 293 K the planet is the reference look, and as the readout climbs the dark sea between the
   rivers comes up toward the rivers' glow until the disk is one orange molten surface (the metals become one material).
   Nothing local, no pattern of our own, no screen-space pooling, never darker than the reference. It cannot look
   "translated" or patchy because it adds no structure; it is the simplest thing that is right, which is V2's brief.
2. Two kinds of metal (two river colours) mixing into one: reads as the "alloy", but too close to mark's new together
   beat (two rivers joining into one hotter river). Rejected.
3. Crystal grains / a cooling front: needs new structure on the planet (the "stuff moving around" he disliked) and a
   look the reference doesn't have. Rejected.
4. Keep the domain-warped Nov 2 metal but spread evenly: still a pattern of ours on top of the lava's rivers, two
   materials at once. Rejected.

Details: `lib/world/thesis.ts` (+0.3 lava heat units = +255 K at 1811 K, a warm floor of 22% from the moment the thesis
owns the sea so the night sea after ventures never reads black; in over the last 15% of ventures, out over shore
0-0.45); its own camera keys (from the sea at h 30 into an orbit view like the reference, the limb at ~73% on phones,
the type above it in the sky); the two lines cross-fade over a longer, eased window (0.26-0.6 of the pin). Shore's
phone pitch follows on (-10/-8.5) so the planet stays in frame. Frames: `shots/v2/` (iPhone, q 4).

## Nov 10: the chapters as film titles over the planet
Reviewer: "walls of 16 px text, about 7,000 px on phone", the blue band and orange limb passing behind paragraphs,
"No signal" boxes that read as broken images, stars as specks between the letters. Jacob (R3): "come up with some ideas
to make the biography pages look better".

1. **Composition first (journey.ts, the story / story-2 / story-3 keys).** The limb never stands behind the lines being
   read. Phones: the horizon / limb lies ~80% down the frame through all three places (pitch = the limb's angle off the
   axis - dip, for the phone's width-locked fov), the type above it on the sky; only the lines coming in at the bottom
   cross the disk, with `quiet` 1. Wide screens: the camera banks (roll -82) in story-2 and the start of story-3, so the
   planet stands on the RIGHT (limb ~235 px right of centre at 900 px high, it scales with the height) and the column
   has the left half; it levels out as it comes down through Charlie's account. story-3 now ends at h 320 with dusk
   still on the limb (below ~300 the air's blue band grows tall enough to stand behind half a screen of text; that was
   the old story-3-85 frame). 'look.stars' 0.5 in story-2 / story-3, back to 1 on the last key (channels carry on).
   The end of each place has the limb LOW, because the text leaves upward: the next place's camera move then pulls
   the world up behind it, away from the last lines.
2. **Type (Story.css).** Phone body 17.5 px / 1.6 (17 px under 375), lead 23.8 px / 1.3 at weight 450; wide screens
   19 px in a 40rem column (~67 characters) that always ends ~64 px right of centre: `min(40rem, 50vw + 2rem)`.
   Sentences set larger WHERE THEY STAND (`storyIntro.lifts` in data/home.ts; the words in data/story.ts are untouched
   and nothing is repeated): "People call them the PayPal Mafia." (it leads into the PayPal scene), the sentence about
   the name as the lead of its paragraph, Jacob's last sentence as his closing card, Charlie's "Ultimately, I want to
   spend my life building things that matter." Jacob's break-out stays the one sentence at full display size.
3. **Title cards.** "Why Crucible" at 15vw (two lines on a phone). Each founder: the tube small (7rem phones, 9.5rem
   wide screens) beside the name on two lines at display size, standing on the tube's base line. The sticky side column
   and the reading line are gone (the planet has that side now); after PayPal a small running name says whose words
   carry on.
4. **Length.** Phone 390: 6306 px before, 6188 after (360: 6548 -> 6120). 1440: 4548 -> ~5700, longer: one column
   instead of tube-beside-text, and the lifts. Tooling for this round is in the session scratchpad (layout strips with
   JS off, a per-band contrast estimate on frames).
