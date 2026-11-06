# Handoff: the liquid rebuild of crucibleinnovation.com

You're picking up a visual rebuild of crucibleinnovation.com for Jacob. Every decision below comes from Jacob's own answers to a long round of questions, so treat the **musts** as fixed. How you get there is up to you. Jacob likes ambitious, polished motion and has a good eye: if something reads cheap or unfinished, it isn't done.

## Start here

- **Repo:** `jacobschppskis-hue/Crucible-Innovation`
- **Branch:** work on `claude/optimistic-euler-x1b88r`. Its draft PR is #19.
- **Read first:**
  - `CLAUDE.md` for the stack, rules and quality bar;
  - `README.md`;
  - `.claude/skills/unslop/SKILL.md` before any visual work.
- **Commands:** `npm ci`, `npm run build`, `npm test`, `npm run unslop`.
  - The tests run Playwright against `out/`, so build first.
  - Headless WebGL needs `--enable-unsafe-swiftshader --use-angle=swiftshader`.

## The idea

The whole site is a dark liquid. The cursor, taps and scrolling make waves in it. Everything on the page floats on that liquid and gets rocked by the waves, like buoys. The logo and the venture ingots are real 3D objects floating in it.

## What Jacob wants

### The liquid (every page, phones included)

- The black background should read like actual liquid, with waves that glow orange (Ember).
  - Crisp and in focus.
  - A slight refraction as waves pass.
  - No soft, blurry glow.
- Today's version is `components/Wake.tsx`, a low-resolution grid stretched up. Replace it.
- **Layer:** over every section's background (including the pinned scenes and the footer, which cover it today), but never over text, buttons or images.
- **What makes waves:**
  - cursor movement, clicks, taps and finger drags;
  - the existing scroll wake (scrolling drags the liquid past a resting cursor). Keep it;
  - a gentle idle swell that's always there, so things keep softly moving when nobody touches the page.
- Phones get the full version. On slow devices quality drops automatically rather than stuttering.

### Floating physics

- Things bob with the wave under them and tilt with its slope.
- They drift sideways a little and spring back like a buoy. It should be noticeable and cool, but things stay close to where they belong and centring and layout never suffer.
- Floating things also make small ripples of their own. Keep that small: Jacob said it "could get crazy".
- **Strength, most to least:**
  1. The logo's pieces and the ingots.
  2. Big headings: more than body text, less than the logo and ingots.
  3. Other blocks, such as the portraits. Jacob calls this level "between subtle and noticeable".
  4. Body text, buttons and links: barely.
  5. The top nav and the /sites quote form: never. Nothing moves while someone types.
- You pick the actual numbers. Tune by eye on desktop and phone.

### The home logo: real-time 3D

- **Replace the pre-rendered ring film with a real-time 3D logo.**
  - Today that film is `public/film/ring`, scrubbed by `components/Ignition.tsx`.
  - The new logo has two arcs, 18 squares and a core, each its own object. Each floats on the waves on its own, and the cursor can push them.
- **Look:** keep the current rendered look, which Jacob likes: sand-cast bone metal and warm light.
  - Baking textures from `film/ring.py` is one route. `pip install bpy` gets Blender 5.2 on Python 3.13.
- **No box behind it.**
  - Today's film frames are opaque. That's the dark square that hides the ripples during "Not the person" / "Not the model".
- **Constant glow.**
  - The logo always looks the way it does right at "Neither, alone", just before it used to switch back to the flat version.
  - The core is a nice orange, but never so bright that its texture is hard to see.
  - Same on load, during the story and after. The core never goes dark.
- **Squares sit upright like screen pixels.**
  - Each stays centred where it is now, but stops turning with the circle.
  - This applies everywhere the mark appears:
    - `lib/splitRing.ts` and `SplitRing`;
    - the nav;
    - the favicon, apple icon and share images;
    - the pour's mould and dot grid;
    - the Crucible Sites ingot;
    - the business card (`brand/`, then re-render its PDF and PNGs).
- **The pour in 3D.**
  - Same beats as today's CSS pour: a crucible tips, the stream fills the core, metal rises through a mould of the logo, it cools from white-hot to the glowing finished logo, and the logo starts floating.
  - The headline still rises with it.
- **The scroll story keeps its beats:** the squares scatter, then the arcs leave, then everything fuses at "Neither, alone". Every piece keeps glowing and floating the whole way.

### The ventures' ingots: freestanding 3D

- Jacob's reference is the icebergs on igloo.ink. The ingots should be freestanding objects that are part of the page: no floor, no background box, nothing that looks unfinished.
- They're real-time 3D and turn about 60–90° as they scroll through, facing you square-on at the centre of the screen, with a slight tilt. They also float on the waves (strong level).
- **Crucible Sites:** the same cooled plaque, standing alone with no sand floor. Its mark uses the upright squares.
- **Verge and Trellis** (still "in the furnace"): hot glowing metal set into a freestanding sand-mould block, like a brick.
- **Where:** the home ventures section, the /ventures page and each venture page.
  - Today they're stills in `public/film/ingots` (from `film/ingots.py`), used by `VentureObject` in `components/Ventures.tsx`.

### Thesis (293 K → 1811 K)

- Bring back the rising fluid flames from the Nov 2 build, stronger than before: they climb higher and fill more of the screen as the reading reaches 1811 K.
  - The code still exists in `lib/gl/molten.ts`.
  - To see the original, build commit `1980594` and open it with `?tier=rich`.
- The flames replace the rendered iron film. Keep the current type and copy.

### Footer

- Back to the dark footer, with molten metal glowing under the giant "crucible" wordmark.
  - It's in the Nov 2 build too (`Furnace` and `FurnaceGL`, removed in `3ff29cc`).
- Keep today's layout and links. Remove the bone (light) footer. Every page.

### Founders' story

- **Remove the iron + carbon → steel beat:** `AlloyBeat` in `components/Story.tsx` and its styles in `Story.css`, the orange dot going into the Fe. Jacob finds it bland next to the rest of the site.
- **Portraits:** go back to Jacob's and Charlie's original ASCII art (`public/team/jacob.webp` and `charlie.webp`).
  - Invert it to bone-coloured characters sitting straight on the black, with no card.
  - It floats like everything else.
  - This applies on the home page and on /sites.
  - Remove the engraved versions once nothing uses them.

## Where you have room

- **Libraries:** three.js or raw WebGL, and how the liquid, the physics and the 3D share a loop.
  - Keep 3D code out of first load: it loads after load and idle.
- The exact look of the liquid, the glow levels, the motion curves and the pour's choreography.
- Small touches that make it feel more physical, as long as they fit the brand rules and don't add clutter.
- If something Jacob asked for genuinely fights the quality bar, find the version that keeps both. Ask him only if no version can.

## Rules that still hold (CLAUDE.md)

- **Lighthouse:** mobile ≥ 95 in all four categories.
- **JS budget:** `/sites` first-load JS well under 200 KB gzipped.
- **Layout:** no horizontal scroll at 360px.
- **Accessibility:** AA contrast and visible Ember focus rings.
- **Ember:** about 3 Ember elements per screen at most.
- **Reduced motion and no JS:** with `prefers-reduced-motion`, without JS or without WebGL, show a clean static version (the SVG logo, and stills for the ingots). Nothing is hidden without JS.
- **Copy rules:** no gradient text and no second display face. Never write "LLC", a street address or payment details. No fabricated testimonials or stats.

## Done means

- Every item above is built.
- You checked it in a real browser, on desktop and on a phone viewport, with screenshots: on load, during the story, the Thesis, the ventures and the footer.
- The tests are updated and pass. `npm run unslop` passes.
- `CLAUDE.md` and `README.md` describe the new setup: the liquid, the floating, the 3D logo and ingots, the footer and the portraits.
- The work is committed and pushed to the branch, and PR #19's description is updated.
