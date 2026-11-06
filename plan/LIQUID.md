# Liquid page: the 3D logo, the floating page, the ingots

**Status: Jacob's answers collected 2026-11-06. Nothing below is built yet.**

This is the spec the build loop works from. Mark each item `[x]` as it ships, and note any change of plan under it.

**Sizes:**
- **S:** under an hour of agent time.
- **M:** a few hours.
- **L:** a large share of a session.

**References:**
- The "before" for the flames and the dark footer is the Nov 2 build: commit `1980594`, opened with `?tier=rich`.
- The comparison shots sent with the questions:
  - Thesis now vs the flames.
  - Footer now vs the old dark one.
  - The box behind the 3D logo.
  - ASCII vs engraved faces.
  - The ingots as they are now.

## A. The 3D logo (home opening)

1. [ ] **Real-time 3D logo.** (L)
   - Replace the pre-rendered ring film (`public/film/ring`, scrubbed in `Ignition`) with a real-time WebGL logo:
     - two arcs, 18 squares and the core, each its own object with its own physics.
   - Match the current render's look: sand-cast bone metal with grain, warm key light, rims on the bevels.
     - Bake albedo, normal and roughness textures from `film/ring.py`'s materials. `bpy` 5.2 installs from PyPI in a cloud session.
   - The canvas is transparent. There is no box behind the logo.
     - Today the frames are opaque RGB. That is the square that hides the ripples during the story.
   - Fallbacks: reduced motion, no JS and no WebGL keep the static SVG (light tier).
   - On slow frames it lowers its own quality rather than stalling.
2. [ ] **Constant glow.** (M)
   - The whole logo always looks the way it does at "Neither, alone", just before it used to hand back to the flat SVG.
   - The core is a nice orange, but not so bright that its texture is hard to see.
   - It looks the same on load, all through the story and afterwards. The core never goes dark or shrinks.
   - On the rich tier the logo never goes back to the flat SVG.
3. [ ] **Upright squares, everywhere.** (M)
   - Every square stays centred exactly where it is now, but sits upright like a screen pixel instead of turning with the circle.
   - Applies everywhere the mark appears:
     - `lib/splitRing.ts` (pixels' `deg` → 0) and `SplitRing`
     - nav, favicon, apple icon, OG images
     - the pour's mould cavities and molten dot grid
     - the Crucible Sites ingot's mark
     - `brand/business-card.html`, then re-render the PDF and PNGs
   - Check that the end squares still meet the arc ends cleanly.
4. [ ] **The pour in 3D.** (L)
   - Same beats as today, in 3D, with the logo facing you:
     - a 3D crucible tips;
     - the stream fills the core;
     - molten metal rises through a 3D mould of the logo;
     - it cools from white-hot through orange to the glowing finished logo (item 2);
     - the logo then starts floating.
   - The headline rises as it does now.
5. [ ] **The story, floating.** (M)
   - Same beats as now:
     - "Not the person": the squares scatter.
     - "Not the model": the arcs leave.
     - "Neither, alone": everything fuses.
   - Every piece stays glowing and keeps floating on the ripples while it is apart.
   - The cursor can push the pieces.

## B. The liquid

6. [ ] **A liquid surface.** (L)
   - The black background reads as actual liquid: crisp, in-focus highlights and a slight refraction as waves pass.
   - The waves glow orange.
   - Drawn at full resolution in WebGL, not today's low-resolution glow stretched up (`components/Wake.tsx`).
7. [ ] **Layer: over backgrounds, under words.** (M)
   - Visible on every section's black, including inside the pinned scenes and the footer, which cover it today.
   - Never drawn over text, buttons or images.
8. [ ] **What makes waves.** (S)
   - Cursor movement, clicks, taps and finger drags.
   - The scroll wake: scrolling drags the liquid past a resting cursor. Kept.
   - A gentle idle swell always moves through the liquid, so things keep softly bobbing when nobody touches the page.
9. [ ] **Every page.** (S)
   - Home, /sites, /work, /ventures and the 404 are one liquid surface.
10. [ ] **Phones get the full version.** (S)
    - Same as desktop: taps send ripples and a dragged finger leaves a wake.
    - Quality drops automatically on slow phones instead of stuttering.

## C. Floating physics

11. [ ] **Bob, tilt, drift and spring back.** (L)
    - Things rise and fall with the wave under them and tilt with its slope.
    - Waves push things sideways a little, and they spring back like a buoy. It should be noticeable and cool, never wild.
    - Everything stays close to where it belongs. Centring and function are never impaired.
    - Two-way water: floating things make their own small ripples as they bob. Keep this small, because it could get crazy.
    - Not chosen: logo pieces colliding with each other.
    - Overall strength: between subtle and noticeable.
12. [ ] **Strength by kind.** Start values to tune by eye, in the same order Jacob ranked them:

    | Kind | Strength | Start values |
    | --- | --- | --- |
    | Logo pieces (each square, arc and the core) | most | 10–20 px, a few degrees |
    | Ingots | most | 10–16 px, 2–4° |
    | Big display headings | more than body, less than logo and ingots | 4–8 px, ~1° |
    | ASCII faces and other blocks | between subtle and noticeable | 3–5 px, under 1.5° |
    | Body text | barely | about 1 px |
    | Buttons and links | barely | under 1 px, so they are always easy to hit |
    | Top nav | never moves | 0 |
    | Quote form on /sites | still while you type | 0 |

## D. Thesis

13. [ ] **Bring back the flames, stronger.** (M)
    - Behind 293 K → 1811 K, bring back the rising fluid fire from the Nov 2 build (`lib/gl/molten.ts`, still in the repo).
    - It replaces the rendered iron film.
    - Stronger than before: it rises higher and fills more of the screen as it reaches 1811 K.
    - Keep the current type and copy. The light tier keeps the CSS furnace.

## E. Footer

14. [ ] **Back to the dark footer.** (M)
    - Use the old dark footer, with molten metal glowing under the giant "crucible" wordmark (the Nov 2 rich tier: `Furnace` + `FurnaceGL`, removed in `3ff29cc`).
    - Keep the current layout and links. Every page.
    - Remove the bone (light) footer and its cooling front.

## F. Founders' story

15. [ ] **Remove the carbon-into-iron beat.** (S)
    - Remove the orange dot going into the Fe to make steel: `AlloyBeat` in `components/Story.tsx` and the `.beat-alloy`/`.alloy-*` styles in `Story.css`.
    - Update the README and the component comment.
    - The PayPal split beat stays.
16. [ ] **The original ASCII faces, light on black.** (S)
    - Go back to Jacob's and Charlie's own ASCII art (`public/team/jacob.webp`, `charlie.webp`).
    - Invert them to bone-coloured characters straight on the black page. No card.
    - They float (item 12).
    - Applies to the home Story and the /sites builders.
    - Drop the engraved portraits, `scripts/engrave.py` and their CLAUDE.md notes once nothing uses them.

## G. Ingots

17. [ ] **Freestanding 3D ingots that turn as you scroll.** (L)
    - Real-time 3D, like the igloo.ink icebergs: freestanding, part of the page, no floor and no background box.
    - Shown on the home ventures section, the /ventures page and each venture's own page.
    - Crucible Sites: the cooled plaque on its own, with no sand floor. Its mark uses the upright squares (item 3).
    - Verge and Trellis (still in the furnace): hot metal set into a freestanding sand-mould block, like a brick.
    - Motion:
      - each turns 60–90° as it scrolls through, square-on at the centre of the screen, with a slight tilt;
      - each bobs on the ripples strongly (item 12).
    - Light tier: stills of the same freestanding objects on a transparent background.

## H. Housekeeping

18. [ ] **Docs and tests.** (M)
    - Update CLAUDE.md and README for: the tiers, the films (ring and iron no longer used), the liquid, the float system, the footer, the portraits.
    - Update `tests/opening.spec.ts` and the other specs for the new opening, footer and portraits.
    - Run `npm run unslop`.

## Quality bar (unchanged, from CLAUDE.md)

- Lighthouse mobile ≥ 95 on all four categories, on every page CI checks.
- `/sites` first-load JS well under 200 KB gzipped. 3D code loads only after load and idle.
- No horizontal scroll at 360px. AA contrast. Visible Ember focus rings. About 3 Ember elements per screen at most.
- Everything respects `prefers-reduced-motion` and stays readable with JS off.

## Suggested order

1. Quick wins: 15, 16, 14, 13.
2. 3 (upright squares).
3. 6–12 (the liquid and the float system, which everything else sits on).
4. 1, 2, 5 (the logo).
5. 4 (the pour).
6. 17 (the ingots).
7. 18.
