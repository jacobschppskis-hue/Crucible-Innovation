# Your workstream: the liquid (idle ocean, the cursor's wake, iPhone touch, no masks)

Branch: `claude/inspiring-allen-sz5kjl-liquid`

The whole site is a dark liquid (`lib/liquid/`, mounted by `components/Liquid.tsx`; read CLAUDE.md "The liquid", "One
clock" and "Floating" closely first: sim.ts wave grid + FINE band, swell.ts analytic swell, input.ts sources, shader.ts
look, render.ts/liquidWorker.ts/engine.ts drawing, field.ts sampling for floaters, float.ts floating + text mask).

## Jacob's words (verbatim)
1. "There should be some background movement when you're not touching the site, but just a little bit of waves, just some
   slight waves going across the screen constantly, like an ocean. And then when you drag, it makes a more marked effect.
   Just slight waves."
2. "When you're moving the cursor fairly slowly, it seems to be only picking it up at separate points, so it just makes a
   few different ripples out emanating from just the dots. It doesn't mean that you have to increase your sample speed,
   but just make it so that it'll have proper smooth lines, like a boat making a wake in the water, rather than a bunch of
   drops in a line."
3. "You need to make it better for iPhone users because the touch on iPhone doesn't make it great for the cursor, causing
   ripples. It will kind of work when you scroll, but it's still not great. It is fairly blocky, and it does the drops
   thing instead of a boat making a wake."
4. "Remove the black outlines from behind things that you don't want the ripple to go behind. Just remove the masking so
   that the ripples, because right now, if I move my cursor and the ripples go across the screen, I can see that there's
   a black outline around the PayPal, YouTube, LinkedIn tree. I want you to fix that entirely from the whole page."

## What to do
1. **Idle ocean.** Today the swell only moves a faint sheen. Make slight, visible waves travel across the screen all the
   time, like ocean swell rolling in: long-crested, a consistent general direction with gentle variation, slow, quiet,
   catching a little light along their crests (a soft warm sheen; the bright Ember glints stay for waves the visitor
   makes). It must stay calm enough to read over, and never look like a screensaver pattern or a moiré. Floaters already
   ride the swell (they must keep doing so, from the same model on CPU and GPU).
2. **A boat's wake at every speed.** Slow, medium and fast cursor moves must leave a smooth, continuous wake: clean
   unbroken lines in a V behind the pointer (a Kelvin-like wake: diverging arms and, ideally, faint transverse ridges),
   following curved paths smoothly, fading behind; never rings emanating from discrete points, never beads, never a
   "sonar tunnel". The cause today: below ~1.6x the wave speed (420 px/s) the moving source is an 8.5 Hz oscillator,
   which in a non-dispersive wave equation can only make Doppler-squeezed rings from successive points. Real water makes
   a V at any speed because it is dispersive. Options (your call, prove it with frames): an analytic dispersive wake
   from the pointer's recent path (Cauchy-Poisson / Kelvin superposition), evaluated in the shader like the swell and on
   the CPU for floaters (`samplePx`/`footprint`); a slower wake band so typical cursor speeds are supersonic with a
   continuous moving pressure source; a GPU dispersive sim; something better. Whatever you pick: one wave model that what
   you see and what floaters feel agree on, anti-aliased (no shimmer/aliasing when the wavelength gets short), smooth at
   60 fps and on phones, and cheap on software GL (CI/PageSpeed).
   **Dragging** (mouse button held, finger on the glass) makes a stronger, more marked wake than hovering.
3. **iPhone.** Touch must make the same smooth wake: a finger dragging on the liquid, and scrolling with a finger (the
   finger's spot moving through the page's liquid), plus momentum after lift. Nothing blocky: find what makes it blocky
   on phones (render scale steps? the 7 px grid? FINE band drops? the canvas being upscaled?) and fix it so it is as
   smooth as desktop. Taps stay a single clean drop. Test with Playwright mobile emulation (`devices['iPhone 15']`,
   hasTouch) using real touch input via CDP (`Input.dispatchTouchEvent` sequences, incl. a touch-scroll), and record
   frame sequences. WebKit may not be installed; Chromium emulation is fine, but keep WebKit's code path (main-thread
   fallback in `engine.ts`) working.
4. **No masks.** Remove the text mask entirely (`textMask` rects from `float.ts`, `uM` in `shader.ts`, `LOOK.textCap`, the
   env dimming by the mask, sim mask raster) so waves pass under text, portraits, the PayPal tree and everything else with
   no dark box or outline. Then look for every other thing that hides the liquid behind content with an opaque or dark
   box (canvases that clear to black, element backgrounds, box-shadows, mask images) across `/`, `/sites`, `/work`,
   `/ventures` and the venture pages, and make them transparent so the waves read continuous. Exception: the nav is opaque
   on purpose (CLAUDE.md explains why); keep it. Keep text legible without a mask: tune the glint strength so even the
   brightest glint under body text is momentary and doesn't wash text out (no halos, no outlines, no per-element dimming).
5. Keep all existing behaviours that aren't mentioned (scroll wake idea, floaters, one clock, workers, quality steps,
   reduced motion = off, `keepDragsForWaves`, hooks `__liquid`). Update `tests/liquid.spec.ts` to test the new behaviour
   (e.g. a slow straight drag leaves a continuous ridge line: sample heights along lines perpendicular to the path behind
   the pointer and check the wake has no gaps/beads; the idle swell moves; no mask texture).

## Files you own
`lib/liquid/*`, `components/Liquid.tsx`, `tests/liquid.spec.ts`, and transparency fixes in other components/CSS (small,
local edits; list them in your report). Other sessions are changing: the logo materials (`lib/gl3d` logo files), the
story/PayPal beat (`components/Story*`), the ingots (`lib/gl3d/ingot*`), the Thesis flames (`lib/gl/molten.ts`). Avoid
those files; if a transparency fix is needed inside them, describe it in your report instead.

## Verify (evidence in your report)
Frame sequences (8-12 frames each, 1440x900 crop around the pointer and 390x844 phone) for: idle (no input, 6 s), slow
hover path (60-120 px/s) straight and curved, medium (300-500 px/s), fast flick (2000+ px/s), mouse drag with button
held, phone finger drag, phone touch-scroll with momentum, a tap. Plus a frame with waves passing behind the PayPal tree
(`.beat-split`) and behind body text showing no box. Look at each frame; describe what you saw.
