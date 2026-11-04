# Redesign plan: crucibleinnovation.com

Status: **draft for Jacob's review.** Items are numbered so he can say "keep 1–9, cut 14". Nothing below is built yet.
Once approved, this file is the spec the build loop works from. Mark each item `[x]` as it ships and note any change of plan under it.

Sizes: **S** is under an hour of agent time, **M** is a few hours, **L** is a large share of a session.

## The diagnosis

The site is well engineered (tiers, reduced motion, no-JS, Lighthouse 93+), but it reads as AI-made for three reasons:

1. **It uses one formula everywhere.** Each of the ~8 sections is a small mono uppercase eyebrow, then a grotesk headline whose last word is an Instrument Serif italic, ending in a period, then a grey paragraph, then a grid of rounded cards. The count: 26 eyebrows, 19 mono runs, 19 italic accent words, about 12 headings ending in a period, and display tracking of -0.035em. Archivo, Instrument Serif italic and JetBrains Mono together are the signature look of 2025 AI landing pages.
2. **The tells stack up.** On one screen you can find numbering ("01 · Every screen", "01 LIVE · 02 FORGING"), pills ("Concept"), cards inside cards (the quote box), hairline dividers, about five opacity levels, decorative glows and grain, and dithered ASCII portraits.
3. **It has dead zones.** Between the pinned scenes there are long dark stretches and long text columns with nothing reacting to the scroll (after Ventures, below the Thesis, the founders' columns, the lower half of /sites).

**The reel's list is a budget, not a ban** (Jacob, 2026-11-04). Any one tell is fine where it does a job, such as mono for the kelvin readout, which is real data. What gets avoided is stacking them, or using them as decoration.

## The idea that ties it together: "One pour"

The whole site is one continuous casting. Metal is heated in the opening and poured as you scroll, and each section is something the metal does: it fills a mould, sets into an object, or cools.

**Colour means temperature.** Ember is hot: active, interactive, alive. Bone is cooled: settled, read, done. Hover, focus, progress and the live venture are hot, and everything at rest is cool. This gives the single-accent rule a physical reason, and it's the kind of system rule a design team would write.

**Light comes from the metal.** Glow only appears where hot metal is in the picture. Nothing gets a decorative gradient background.

---

## 0. Groundwork (first, cheap; saves credits on everything after)

1. **`unslop` skill (S).** A project skill in `.claude/skills/unslop/` that every future session loads.
   - It holds the reel's list and states where each tell is allowed (for example: mono only for real data or code; at most one italic or serif "voice" moment per page; no eyebrows by default; no periods in headings).
   - It adds a review checklist each scene must pass before it ships.
   - It ships with `npm run unslop`, which flags a section that **stacks** two or more tells (eyebrow + numbering + mono caps + period, etc.). The check runs in CI.
2. **Reference board (S).** Screenshots and short recordings of pear.no, igloo.inc and the other references, kept in the scratchpad and never committed (they're other people's work). The build loop compares every scene against them (reel tip 1).
3. **Direction board (M).** This is reel tip 3, and it's a checkpoint.
   - Three type and colour variants, each applied to the same two pieces: the home opening and one inner section (Ventures).
   - They live on a hidden `/lab` route and are recorded on phone and desktop.
   - Jacob picks one or mixes them. If there's no answer within about an hour, the build continues with the recommended one, so the credits don't sit idle.

## 1. Design system reset (one pass, touches every page)

4. **Type (M).**
   - Retire the Instrument Serif italic accents and the JetBrains Mono eyebrows.
   - One family does the work, with contrast coming from size, weight and width rather than from a second "fancy" font.
   - Tracking stays at the font's default.
   - The wordmark stays as it is: it's the logo, not body type.
   - Candidates for the board:
     - **A (recommended).** Archivo's own width axis: Expanded for display, normal for text. The brand stays continuous and the slop pairing goes.
     - **B.** An industrial condensed family (Sofia Sans Condensed / Big Shoulders) for display, with a plain grotesk for text.
     - **C.** An editorial serif (Newsreader / Source Serif) for long reading, with a grotesk for UI.
5. **Colour (S).**
   - Hot/cold tokens.
   - Two text tones as solid colours, replacing the current rgba opacity soup.
   - Remove the grain overlay and the decorative glows.
   - Separation comes from space and scale, not hairline dividers.
6. **Fewer boxes (M).** No cards inside cards and no pills. Packages, work, the form and ventures move to open layouts with large media.
7. **Copy pass (S).**
   - No periods in headings, no section numbering, no eyebrows.
   - Cut the repeats: "No payment until you've approved the design" currently appears about five times on /sites. Keep it in two places.
   - The founders' accounts stay word for word.
   - Brand sayings stay, each placed once where it fits.

## 2. Home: one continuous scene

8. **Opening, upgraded (L).**
   - Keep the pour (it's ours) and make it look filmed.
   - Rich tier: a rendered liquid-metal Split Ring (reflections, heat tint, bloom, shallow depth of field) that a cursor or finger can stir.
   - Light tier: high-res pre-rendered frames instead of flat SVG.
   - "Intelligence, alloyed" loses its period and its italic.
9. **The metal never leaves (L).** The poured metal carries down the page and becomes the next scene's object, so there are no hard section edges and each handoff is one motion:
   - ring → founders → ventures → thesis → footer.
10. **No dead zones (S).** Rule: at every scroll position, something in the viewport responds to the scroll. A Playwright script samples every half-viewport on phone and desktop and fails if a sample has nothing scroll-linked in view.
11. **Founders as a reading scene (M).**
    - On desktop the portrait stays pinned beside the text as it's read.
    - Jacob's account gets two visual beats taken from his own words:
      - one PayPal ingot splitting into six named ingots (YouTube, LinkedIn, Yelp, Palantir, SpaceX, Tesla; names only, no logos);
      - iron plus a little carbon becoming steel.
    - Charlie's account gets its own chapter with one beat.
    - *This replaces side-by-side columns with chapters; Jacob decides.*
12. **Ventures as a foundry floor (M).**
    - A pinned horizontal rail.
    - Crucible Sites is cast and cool, with a live site inside it.
    - Each next venture is still glowing in its mould, so its shape is visible but unfinished.
    - Clicking a venture opens its page.
13. **Thesis (M).** Keep 293 K → 1811 K, which is genuinely good. Scroll now scrubs rendered footage of iron melting, and the kelvin readout keeps its mono because it's data.
14. **Closing (S).** The metal cools into the giant wordmark, with contact details beside it.

## 3. /sites: the page the QR opens (phone first)

15. **"Try it with your business" (M).**
    - The visitor types a business name and picks a trade (café, barber, landscaper, salon, plumber, gym…).
    - The live concept site is recast with their name and a palette for that trade.
    - It's all in the browser, nothing is sent, and it's labelled Concept.
    - This is the strongest single conversion lever on the site.
16. **Keep the phone morph and recast scene (S).** Drop "01 ·" numbering from its captions.
17. **Before/after becomes a renovation (M).** As you scroll, the dated site comes apart and is recast piece by piece. The drag handle stays as a fallback.
18. **Process becomes seven days you can scrub (M).** The site builds up day by day: call, draft on day 3, edits, live on day 7. Less text.
19. **Work becomes browsable (M).** The concept sites are real HTML, so they open full screen inside phone and desktop frames and visitors can scroll them.
20. **Packages, open layout (S).** Three columns, with Alloy "hot".
21. **The quote form goes one question at a time (M).** Same mail/Gmail/Outlook/Formspree flow, same `ref` tagging.

## 4. High-definition visuals

22. **Film pipeline in code (L, mostly background render time).**
    - Blender scenes are Python files in `film/*.py`, rendered in the cloud container. Tested today: about 23 s per 720p frame on 4 CPU cores, so a 90-frame scroll clip is about 40 minutes in the background.
    - Clips are encoded to AV1 + H.264 with AVIF posters and scroll-scrubbed. They load after first paint, and the light tier gets stills.
    - Shots: the crucible heating, the pour, metal filling the Split Ring mould, a cooling-ring macro, sparks, iron melting.
23. **Optional AI footage (S for me, Jacob generates).**
    - I write exact Higgsfield/Veo/Kling prompts (shot, lens, light, duration, loop point, colour) for 3–4 hero clips.
    - Jacob generates them and drops them in `film/in/`, and the pipeline grades them to match.
    - This is only worth it if Blender's look isn't photoreal enough.
24. **One lighting model (S).** Warm key from below, cool fill from above, in every render and grade, so every image looks shot in the same room.

## 5. New pages

25. **`/work` and `/work/[slug]` (M).**
    - Everything Crucible has published, each with its own case-study page.
    - Available now: this site (how the pour was built), the business card, the brand mark, and the three concept sites, labelled Concept.
    - Real client work is added as it ships. *Needs Jacob's list.*
26. **`/ventures` and teaser pages (M).**
    - What's live and what's next. Each forging venture gets a one-line promise and its glowing-mould visual.
    - A "Tell me when it ships" link (mailto, or Formspree when set).
    - No invented stats or dates. *Needs Jacob's list; see the questions below.*
27. **`/about` (S, optional).** Both founders' full accounts and the thesis. Home then shows a strong excerpt with a link.
28. **Shared-element page transitions (M).** View Transitions: a venture or work card expands into its own page, extending the existing "pour" transition.

## 6. Site-wide

29. **Mobile menu (S).** There isn't one today.
30. **Nav and footer redesigned to match (S).**
31. **OG images and the business card (S).** Move them to the current ring geometry and the new type.
32. **Remove `overnight/` (S).** It holds 14 MB of recordings.
33. **Sound (optional; recommended skip).** Furnace ambience, off by default.

## 7. Quality gates (every item)

34. **Record and review.** Every scene is recorded on phone and desktop and reviewed against the unslop checklist and the reference board before moving on, then fixed and re-recorded.
35. **Existing bars still hold:**
    - Lighthouse mobile ≥ 95 in all four categories;
    - /sites first-load JS well under 200 KB;
    - reduced motion and no-JS stay readable;
    - no horizontal scroll at 360 px;
    - AA contrast;
    - Ember focus rings;
    - CI green.

## Order and credit strategy

- **Order:**
  1. Groundwork: 1–3.
  2. System reset: 4–7.
  3. The two first impressions: the home opening (8–10) and the /sites hero toy (15).
  4. Film: 22, rendering in the background while other work continues.
  5. The rest of home (11–14).
  6. The rest of /sites (16–21).
  7. Pages: 25–28. These can run as parallel agents once the system is fixed.
  8. Site-wide: 29–32.
- **Every item ends committed and pushed, with the site shippable.** If credits run out mid-list, everything above the cut is finished.
- The direction board (3) is the only planned stop. Everything after it runs without waiting.
