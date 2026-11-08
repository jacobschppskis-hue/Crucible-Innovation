# Crucible Final V2: one look, simpler, sharp on the phone

Started 2026-11-08 ~20:00 UTC. Same team as the final build (`plan/final/TEAM.md`), same contract
(`lib/world/ARCHITECTURE.md`), same quality bar (`plan/final/README.md`, "The quality bar"). Read `plan/final/JACOB.md`
for everything Jacob has liked and disliked. **This file wins where they disagree: it is his newest word.**

Trunk: **`claude/inspiring-allen-sz5kjl-v2`** (from the final build plus the CI fix, ba130fc). The trunk rules in
`plan/final/README.md` ("How we work on one branch") apply with the trunk renamed. Don't ask Jacob anything: the
coordinator (`session_01PrrUSitYmSR7aDjHHAhibr`) relays. Report there with `send_message`.

## The reference: `plan/v2/reference-orbit.webp`

Jacob, on this frame (from the published final build, on his Mac): **"I like how it looks right here. I want to keep
this look for the whole thing."** What is in it:
- the planet seen from orbit at dusk: a dark red molten disk that glows faintly by itself;
- meandering orange rivers of molten metal across it;
- a thin, bright sunset band along the limb, then a blue atmosphere glow, then black sky with plenty of stars.

The one defect in it is the blocky lava at the upper left near the limb. Fix that; keep everything else.

## What Jacob said (verbatim, 2026-11-08 ~19:50 UTC)

> I like how it looks right here. I want to keep this look for the whole thing. I want you to make another version
> called "Crucible Final V2," where it's more consistent. You don't have it do all of the different crazy things. You
> just keep it fairly consistent and simple so you get it right. There are many examples of where you got it
> wrong.For example, a lot of times it's just completely black and the only thing that you can see is the lack of
> stars, and if you move your cursor, it'll make the little blips. Also, after it gets black, when the temperature is
> rising from 293 to 1,811, there's the base part, and then only at the front part of the planet, there's a bunch of
> stuff moving around, it just doesn't look good. You can't translate defects constantly. It was supposed to be
> rebuilt.
>
> I like the physics of the water after you scroll just past where it says "intelligence alloy." The water looks good
> there. It's fairly zoomed in. Remove what looks like sea foam or the bubbles from the water, so it's just the water.
> Then it kind of zooms in on a weird glowing patch before the PayPal. Not sure if that's just random rendition or if
> that's supposed to be.
>
> Everything looks fairly good on the Mac, on web, just remove when you scroll up, the three pillars next to each
> other, I want it to be so it's always the crucible one in the center and the outside ones, crucible sites in the
> center. Or actually, never mind. Forget about that part. It's good.
>
> But the logo is glitching on the monolith that's rising out, the crucible logo glitches around the edges. It's
> pretty good. On the phone, there are some problems, and I'm not sure if it's because it's in the artifact and will
> be better once it's published to the official site.
>
> Another thing, I don't really like the "Not the model, not the person" where it says, "The human half, the machine
> half." That animation is dumb. And so is the human half, machine half thing. Just the whole animation is dumb. Find
> a better way to explain the idea that they're stronger together.
>
> I don't like the things going around in the circle at all. The landing hero right before you scroll, where the
> crucible logo is in the sky, is fairly good. Just make it more detailed and less pixelated, because right now the
> squares that are slightly tilted just have very obvious pixel lines in them.
>
> On the phone, everything is just super out of focus. The logo is super pixelated. When you're scrolling, In a few
> spots, it's fairly glitchy, especially during the PayPal animation. Everything is very low res, like the jumps out
> to the side to establish the other colon user of the other companies from the PayPal. The lines are very low
> quality, and it's a little glitchy.
>
> The monoliths on the phone are absolutely terribly out of focus. The lines are super pixelated. The logo is hardly
> in focus. The pixels of the logo (the big squares in the logo, not the actual pixels on the screen), they're
> grouping together, meshing together, so it's just terrible.
>
> Fix the heating up thing. Make all the transitions smoother. The "alloy is stronger than its metals" thing. Nothing
> new happens at 293 K. That animation is okay, but see if you can change it out for something else that fits better
> or just is different.
>
> Always make it so that you can see the planet. Never have it so dark that you can't see it or the atmosphere. Make
> it so you can see a glow around the atmosphere and a slight glow from the planet, always.
>
> Make the stars slightly more prevalent for iPhone. Those are the major things. You can spin up some more agents and
> fix it.

## Decided (the coordinator's reading; don't relitigate)

1. **One look, start to finish:** the reference frame's palette and light, a dusk planet with rivers of molten metal,
   a limb glow and stars. Cut the "crazy things": fewer, slower, simpler camera moves; no beat that changes the
   world's whole look. Doing fewer things well beats doing many things roughly.
2. **Never black.** From every camera position the planet's disk is visible by its own faint glow, and the atmosphere
   glow around the limb (or the horizon band at sea level) is always there. Black space only behind the planet, never
   instead of it.
3. **The sea just past the headline is the model for water** (Jacob likes its physics). Remove the foam/bubbles/specks:
   just water. Remove the zoom onto the "weird glowing patch" before PayPal.
4. **Together:** the runs of metal going round the mark's rings ("the things going around in the circle") and the
   captions "The human half" / "The machine half" are gone. Never write "human half" or "machine half" again. The
   default new idea is a **confluence**: two rivers of molten metal on the planet run toward each other and join into
   one river that runs hotter, so it glows brighter and more yellow. Colour means temperature, so "stronger together"
   is shown physically by the world's own material. It doesn't involve the logo and doesn't go round in a circle. At most one
   line of text, "Stronger together" (or a line from Jacob's own text in `data/story.ts`). `mark` may propose a better
   idea only with a strong reason and frames.
5. **Thesis:** keep the two lines (Jacob's words). Rebuild the animation so something visible happens from the first
   scroll. The whole visible planet changes evenly and smoothly, nothing local "at the front", never black at the
   start. Better still, a different animation that fits "An alloy is stronger than its metals"; it must differ from the
   confluence.
6. **The phone is the main target.** It must be sharp: today an iPhone starts at about 1.1 render px per CSS px (a
   third of its screen) and drops to 0.4 on slow frames. Edges (the mark, the monoliths, the PayPal lines, the
   stars) must be crisp at the phone's real resolution. The sea and sky may stay soft. At small sizes the mark becomes
   the brand mark (one ring, four squares, the core: `brandMarkSvg()`/`lib/splitRing.ts`), never 7 + 4 squares
   merging into a blob.
7. **Ventures:** the three monoliths keep their layout (Jacob withdrew that change). Fix the logo's glitching edges on
   the rising monolith, and sharpen everything on the phone.
8. **The hero** (the mark in the sky) is "fairly good": more detail and no stair-stepped pixel lines on the tilted
   squares.
9. **Stars:** a little more visible on iPhone (they mustn't vanish at low render scale).
10. **Transitions:** every change between places is smooth: damped, no snaps, no pops, no flashes.
11. The loop, the copy rules, the no-mask rule and every other rule in `CLAUDE.md` still hold.
12. **A stronger atmosphere** (Jacob, a few minutes later, verbatim): "Make the atmosphere stronger so there's more of
    a sky in the hero page, and it'll just make it fade better and have easier transitions." The hero gets a real
    sky: a deeper, brighter band of dusk atmosphere over the sea, fading up into the stars, which every later place
    shares (the limb glow seen from orbit is the same atmosphere), so the moves between sea level and orbit fade
    through it. `look` owns it; `world` uses it for the transitions.

## Roles (same owners and files as `plan/final/TEAM.md`)

| Role | Session | V2 work |
|---|---|---|
| world (lead) | session_01PrrUSgaxJQ8G1hgJsTo6NP | Decisions 1, 2 (with look), 3 (remove the zoom to the glowing patch), 6 (the crisp path: a second pass at native resolution, up to dpr 3 on phones, for small sharp things; a phone floor; publish the API to owners by M1), 10; integration, loop seam |
| look | session_01PrrUShnpwmYQRWfKH1tJgo | Decision 2 (limb and atmosphere glow always; the planet's own glow floor), 1 (the reference palette everywhere), 9 (stars on iPhone) |
| lava | session_01PrrUShdbpRyac6WsRgLvAN | Decision 3 (no foam/bubbles: just water; keep the physics), the reference's rivers with smooth edges everywhere (no blocky lakes near the limb), the river material for the confluence (with mark) |
| mark | session_01PrrUShRucgFapEL7WBWXVG | Decision 8 (hero detail, no stair-steps), 6 for the mark (crisp, brand mark when small), 4 (the new together beat; delete the ring runs and the halves captions) |
| paypal | session_01PrrUSkhYXhAS1VJ5B1VPng | Decision 6 for PayPal: the lines out to the other companies crisp and steady on the phone, no glitches while scrolling; simpler where it buys smoothness; the reference look |
| ventures | session_01PrrUSiXXihBZvt7P76trxx | Decision 7: no glitching logo edges; crisp monoliths, lines and logo on the phone (brand mark when small) |
| story | session_01PrrUSiLfs8f6VwuZe5pPd6 | Decision 5 (the Thesis rebuilt or replaced), smooth in and out |
| qa | session_01PrrUSka9HW1ECfczYNuYHh | The checks below, an iPhone review of every place against the reference, WebKit if it can be installed (`npx playwright install webkit`), and reports to owners |

`pages` stays idle (Jacob is happy with the other pages).

## Checks (QA owns them; every owner runs them on their own work before pushing)

- **Never black:** at every place, and every 2% of the journey between, on iPhone 15 and 1440 × 900, the planet's disk
  has visible glow and the atmosphere band is visible. Measure it: mean luminance inside the disk and on the rim above
  a floor (QA sets the numbers from the reference frame).
- **Sharp:** at each place on iPhone 15 (dpr 3) at the step a real iPhone runs (pin it with `?q=`), the mark,
  monolith edges and PayPal lines are drawn at ≥ 2 render px per CSS px, with no stair-steps visible at 100% zoom.
- **Smooth:** with 4× CPU throttling on the phone emulation, scrolling through PayPal and ventures has no frame over
  ~50 ms caused by our code (shader recompiles, step changes, layout).
- The loop seam, `npm run typecheck`, `npm run build`, `npm test`, `npm run world:smoke`, and Lighthouse mobile `/`
  ≥ 95 still pass.

## Milestones (UTC)

- (Moved: the team's first turns failed on the account's 5-hour limit at 19:55; restarted 23:35 UTC.)
- **~01:30 M1:** world's crisp-pass API is in; every owner has pushed a first fix with frames under
  `lab/<role>/shots/v2/`. The coordinator builds a "Crucible Final V2" preview from the trunk.
- **~04:00 M2:** everything above done and QA-checked; the trunk freezes; the coordinator merges it into
  `claude/inspiring-allen-sz5kjl` (PR #21) and publishes the final V2 preview.
