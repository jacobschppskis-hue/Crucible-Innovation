# Redesign plan: crucibleinnovation.com

**Status: draft for Jacob's review.** Items are numbered so he can say "keep 1–9, cut 14". Nothing below is built yet.

Once approved, this file is the spec the build loop works from. Mark each item `[x]` as it ships, and note any change of plan under it.

**Sizes:**
- **S:** under an hour of agent time.
- **M:** a few hours.
- **L:** a large share of a session.

## Diagnosis

The site is well engineered: two visual tiers, reduced motion, works without JS, Lighthouse 93+. It still reads as AI-made, for three reasons.

**1. One formula, repeated in every section.** Each of the ~8 sections follows the same shape:
- a small mono uppercase eyebrow,
- a grotesk headline whose last word is Instrument Serif italic, ending in a period,
- a grey paragraph,
- a grid of rounded cards.

The current counts are 26 eyebrows, 19 mono runs, 19 italic accent words and about 12 headings ending in a period, with display tracking at -0.035em. Archivo + Instrument Serif italic + JetBrains Mono is *the* 2025 AI landing-page pairing.

**2. The tells stack up.** One screen can carry several at once:
- numbering ("01 · Every screen", "01 LIVE · 02 FORGING")
- pills ("Concept")
- cards inside cards (the quote box)
- hairline dividers
- about five opacity levels
- decorative glow and grain
- dithered ASCII portraits

**3. Dead zones.** Between the pinned scenes there are long dark stretches and text columns where nothing reacts to the scroll:
- after Ventures
- below the Thesis
- the founders' columns
- the lower half of /sites

**The reel's list is a budget, not a ban** (Jacob, 2026-11-04). A tell is fine where it does a job. Stacking them, or using them as decoration, is what to avoid.

The research backs this up: the award sites use mono, uppercase, tight display tracking, eyebrows and even halftone, but each one has a single job inside one concept. Three things none of them do: Instrument Serif accents, cards inside cards, and ASCII images.

## What the references teach

The full notes are in the research report from 2026-11-04.

**pear.no** (Oslo agency, Awwwards 2026) is the closest model to what Jacob wants.
- **It was built with AI:** Claude Code, GPT Image stills made from **one reusable prompt template** so every image shares a style, and Seedance films. It cost about $160 in credits.
- **One strict metaphor** (a letterpress prospectus with Renaissance paintings and scroll-scrubbed film) is applied to every image, the type and the motion. That consistency is why it reads as designed.
- **The lesson:** the tool doesn't matter; one art direction, enforced everywhere, does.

**igloo.inc** (Site of the Year 2024):
- One continuous camera path through one world, with tiny copy ("Scroll down to discover").
- Every portfolio company sits inside its own object (an ice block).
- 18 sound cues.
- Quality steps down on slow frames.

**Lando Norris** (Site of the Year 2025), **Lusion**, **Immersive Garden** and **basement.studio** (also Next.js + Tailwind) add:
- Extreme type contrast: display at 7–10vw, labels at 10–13px, little in between.
- Surface flips instead of dividers (the page background inverts as a section begins).
- Pinned horizontal tracks and CSS sticky stacks.
- Copy compressed to captions.
- An accent reserved for one role.
- A branded route transition.
- Hovering a list item swaps the main visual.

The research could not open pear.no or igloo.inc directly because this environment's network policy blocks them. The findings come from Awwwards, the studios' write-ups and public mirrors. For the build to screenshot them, allow `pear.no` and `igloo.inc` in the environment's network settings, or send screenshots or a screen recording.

## The concept: "One pour"

The whole site is one continuous casting. Metal is heated in the opening and poured as you scroll, and each section is something the metal does: it fills a mould, sets into an object, or cools.

**Colour means temperature.**
- Ember is hot: active, interactive, alive.
- Bone is cooled: settled, done.
- Hover, focus, progress and the live venture run hot; everything at rest is cool.
- As the metal cools, the page surface itself **flips from dark ground to bone**. That flip replaces divider lines.

**Light comes from the metal.** A glow appears only where hot metal is in the picture. No decorative gradient backgrounds.

**One art direction for all imagery** (Pear's method): "a foundry at night, shot on a macro lens". There is one prompt template and one lighting model (a warm key from below, a cool fill from above), so every still, film and render looks shot in the same room.

---

## 0. Groundwork (first, and cheap; saves credits on everything after)

1. **`unslop` skill (S).** A project skill in `.claude/skills/unslop/` that every later session loads.
   - It holds the reel's list, plus the research verdict on which tells are near-absolute and which depend on execution.
   - It states where each tell is allowed. For example:
     - mono only for real data or code;
     - at most one second-face "voice" moment per page;
     - eyebrows only when they add information;
     - uppercase tracking ≤ 0.05em;
     - no periods in headings.
   - It includes a review checklist every scene must pass.
   - It adds `npm run unslop`, which flags any section that stacks two or more tells. CI runs it.
2. **Reference board (S).**
   - Screenshots and short recordings of the references, kept in the scratchpad and never committed, because they're other people's work. This is reel tip 1.
   - Every scene gets compared against them.
   - It needs the network change above, or Jacob's screenshots.
3. **Direction board (M). This is a checkpoint (reel tip 3).**
   - Three type and colour variants, each applied to the same two pieces (the home opening and the Ventures section), on a hidden `/lab` route.
   - Recorded on phone and desktop.
   - Jacob picks one or mixes them. If there's no answer within about an hour, the build continues with the recommended one, so credits don't sit idle.

## 1. Design system reset (one pass, touches every page)

4. **Type (M).**
   - Retire the Instrument Serif italic accents and the JetBrains Mono eyebrows.
   - One main family carries everything, with poster-scale contrast: display at 7–10vw on a fluid root, small labels, very little in between.
   - Tracking: tight only at display sizes, 0 for body text.
   - The wordmark stays as it is (it's the logo).
   - Candidates for the board:
     - **A, recommended:** Archivo's width axis, Expanded for display and normal for text. The brand stays continuous and the slop pairing goes.
     - **B:** an industrial condensed display face (Sofia Sans Condensed or Big Shoulders) with a plain grotesk for text.
     - **C:** an editorial serif (Newsreader or Source Serif) set *structurally* for statements, the way Immersive Garden does, never as an italic accent word.
5. **Colour (S).**
   - Hot and cold tokens.
   - Two text tones as solid colours, replacing the rgba opacity soup.
   - Surface flips instead of dividers.
   - The grain overlay and the decorative glows go.
6. **Fewer boxes (M).** No cards inside cards and no pills. Packages, work, the form and ventures move to open layouts with large media, plus sticky stacks where a list needs depth.
7. **Copy pass (S).**
   - No periods in headings, no section numbering, eyebrows only where they add information.
   - Copy compressed toward captions.
   - Cut the repeats: "No payment until you've approved the design" appears about five times on /sites; keep it in two places.
   - The founders' accounts stay word for word.
   - Each saying is placed once, where it fits.

## 2. Home: one continuous scene

8. **Opening, upgraded (L).**
   - Keep the pour (it's ours) and make it look filmed.
   - Rich tier: a rendered liquid-metal Split Ring with reflections, heat tint, bloom and shallow depth of field, which a cursor or finger can stir.
   - Light tier: high-res pre-rendered frames instead of flat SVG.
   - "Intelligence, alloyed" loses its period and its italic.
9. **One world behind the page (L).**
   - A fixed layer holds the metal for the whole page, and the content scrolls over it, the way igloo.inc and basement.studio do it.
   - The poured metal becomes each next scene's object: ring → founders → ventures → thesis → footer.
   - No hard section edges; each handoff is one motion or a surface flip.
10. **No dead zones (S).** At every scroll position, something in view responds to the scroll. A Playwright check samples every half-viewport on phone and desktop and fails on any sample where nothing does.
11. **Founders as a reading scene (M).**
    - On desktop the portrait stays pinned while the text is read.
    - Jacob's account gets two visual beats taken from his own words:
      - one PayPal ingot splitting into six named ingots (YouTube, LinkedIn, Yelp, Palantir, SpaceX, Tesla; names only, no logos);
      - iron plus a little carbon becoming steel.
    - Charlie's account gets its own chapter with one beat.
    - *This changes the layout from side-by-side to chapters; Jacob decides.*
12. **Ventures as a foundry floor (M).**
    - A pinned horizontal track.
    - Crucible Sites is cast and cool, with a live site inside it. Each next venture is still glowing in its mould: its shape is visible but unfinished, like the companies inside igloo.inc's ice blocks.
    - Hovering a name swaps the object.
    - Clicking opens the venture page.
13. **Thesis (M).**
    - Keep 293 K → 1811 K; it's genuinely good.
    - Scroll scrubs filmed or rendered footage of iron melting.
    - The kelvin readout keeps its mono, because it is data.
14. **Closing (S).**
    - The metal cools, the page flips to bone, and the giant wordmark sets.
    - Contact details go beside it.

## 3. /sites: the page the QR opens (phone first)

15. **"Try it with your business" (M).**
    - The visitor types their business name and picks a trade (café, barber, landscaper, salon, plumber, gym…).
    - The live concept site is recast with their name and a palette for that trade.
    - Everything happens in the browser, nothing is sent, and the result is labelled Concept.
    - This is the single strongest conversion lever on the site, and it follows Dropbox's lesson: turn information into a toy.
16. **Keep the phone morph and recast scene (S).** Drop the "01 ·" numbering.
17. **Before/after becomes a renovation (M).** As you scroll, the dated site comes apart and is recast piece by piece. The drag handle stays as a fallback.
18. **Process becomes seven days you can scrub (M).** The site builds up day by day: the call, a draft on day 3, edits, live on day 7. Less text.
19. **Work, browsable (M).**
    - The concept sites are real HTML. Each opens full screen inside a phone or desktop frame, and visitors can scroll it.
    - On the page, the three sites form a sticky stack, each sliding over the last.
20. **Packages, open layout (S).** Three columns; Alloy runs "hot".
21. **The quote form, one question at a time (M).** The same mail/Gmail/Outlook/Formspree flow and the same `ref` tagging.

## 4. High-definition imagery

22. **Art direction and one prompt template (S).**
    - Following Pear's method, write a single house prompt plus shot list.
    - Every still and film is generated from it, so everything matches.
    - It covers lens, light, palette (Ember only), grain and framing, with loop points for scroll-scrubbed shots.
23. **Atmospheric film from Higgsfield (S for me; Jacob generates).**
    - About 4–6 clips: the furnace at night, molten metal pouring in macro, sparks, iron going from cracks to liquid, a cooling surface, and hands at a workbench.
    - Seedance, Kling or Veo inside Higgsfield all work.
    - Jacob drops them in `film/in/`. The pipeline grades them to the house look, encodes them (AV1 + H.264, with AVIF posters), loads them after first paint, and scroll-scrubs them. The light tier gets stills.
    - This spends Higgsfield credits, not Claude credits.
24. **Blender renders for brand-exact objects (L, mostly background time).**
    - AI video can't hold the Split Ring's exact geometry, so the ring, the mould and the venture objects are Blender scenes written in Python (`film/*.py`) and rendered in the cloud container.
    - Tested today: about 23 s per 720p frame on 4 CPU cores, so a 90-frame scroll clip takes about 40 minutes in the background.
    - The same lighting model is used, so the renders sit beside the generated film.
    - If Jacob skips 23, Blender also covers the atmospheric shots, in a less photoreal look.

## 5. New pages

25. **`/work` and `/work/[slug]` (M).**
    - Everything Crucible has published, each with a case-study page that has a "backstage" layer of how it was made (Immersive Garden's idea).
    - Available now:
      - this site (how the pour was built);
      - the business card;
      - the Split Ring mark;
      - the three concept sites, labelled Concept.
    - Real client work is added as it ships. *Needs Jacob's list.*
26. **`/ventures` and teaser pages (M).**
    - What's live and what's next. Each forging venture gets a one-line promise, its glowing-mould object, and a "Tell me when it ships" link (mailto, or Formspree when set).
    - No invented stats or dates. *Needs Jacob's list (see the open questions).*
27. **`/about` (S, optional).** Both founders' full accounts and the thesis. Home then shows a strong excerpt and links here.
28. **Branded page transitions (M).** View Transitions: a venture or work card expands into its page, extending the existing "pour" transition.

## 6. Site-wide

29. **Mobile menu (S).** There is none today.
30. **Nav and footer redesigned to match (S).**
31. **OG images and the business card (S)** move to the current ring geometry and the new type.
32. **Remove `overnight/` (S)**, which holds 14 MB of recordings.
33. **Sound (optional; recommend skipping for now).** igloo.inc's 18 cues are part of its magic, but sound is the lowest-value item for a sales site that people open from a business card.

## 7. Quality gates (apply to every item)

34. **Record and review.** Every scene is recorded on phone and desktop and reviewed against the unslop checklist and the reference board before moving on, then fixed and re-recorded. Rich-tier quality steps down (DPR first) on slow frames before it hands back to the light tier.
35. **The existing bars hold:**
    - Lighthouse mobile ≥ 95 in all four categories;
    - /sites first-load JS well under 200 KB;
    - readable with reduced motion and without JS;
    - no horizontal scroll at 360 px;
    - AA contrast and Ember focus rings;
    - CI green.

## Order and credit strategy

1. Groundwork: items 1–3.
2. System reset: items 4–7.
3. The two first impressions: the home opening (items 8–10) and the /sites toy (item 15).
4. Imagery: items 22–24. Blender renders in the background while other work continues; Higgsfield clips slot in whenever Jacob sends them.
5. The rest of home: items 11–14.
6. The rest of /sites: items 16–21.
7. Pages: items 25–28. These run as parallel agents once the system is fixed.
8. Site-wide: items 29–32.

How it runs:
- Every item ends committed and pushed, with the site shippable. If credits run out mid-list, everything above the cut is finished.
- The direction board (item 3) is the only planned stop.

## Decisions (Jacob, 2026-11-04)

- **Keep everything above** except item 23 (Higgsfield): Blender does all imagery. Sound (33) is skipped.
- **Ventures:**
  - **Verge**: "an AI coach for endurance sport. The algorithms behind it took a long time to build, the goal being coaching good enough for an athlete to rely on. Coming soon."
  - **Trellis**: "an AI-powered planner, made to help people sort out what they need to do and when they need to do it. Coming soon."
- **Work:**
  - No sites are published yet. Three are close.
  - `/work` gets client slots: name, short description, an embed, and a link. Jacob will send the URLs.
  - Until then, the page shows what exists: the concept sites (labelled Concept), this site, the card and the mark.
- **Portraits:** no real photos. Claude's call is **engraved line portraits**, made from the existing ASCII ones. Engraving is metalwork, so it fits the concept.
- **Founders:** shown separately, as chapters, and described as co-founders, with **Jacob first**.

## Open questions (answered above)

1. **Ventures.** This session can't read Jacob's claude.ai chats. Google Drive has two candidates:
   - **Cadence**, a day planner app (PRD, September). Its pitch: "the day planner that actually fits".
   - **Apex Coach**, an AI running coach (PRD, May). It sits under Lemn with Hiro and Hailey, so it may not be Crucible's.

   Which go on the site? Are there others? A name and one line each is enough.
2. **Work.** What has Crucible published so far? Are any Crucible Sites clients live yet?
3. **Portraits.** ASCII/dithered portraits are on the "near-absolute" list. The options:
   - keep them;
   - switch to real photos lit in the house style (this reverses the earlier "never commit real photos" rule);
   - switch to engraved line portraits.
4. **Footage.** Will Jacob generate the Higgsfield clips (item 23), or should Blender cover everything?
5. **Founders.** Keep them side by side, or switch to chapters (item 11)?
