# lava: notes

## What is on the trunk
- `lib/world/glsl/lava.glsl`: `lava_shade`, `lava_env`, `lava_interact` (wake + rings), `lava_swell`.
- `lib/world/lava.ts`: the module. Swell spectrum, uniforms, the hand, the CPU mirror `lavaSample(u, v)`, `window.__lava`.
- `lib/world/wake.ts`: the wake (path samples, merge, rings, packed in a 384x1 RGBA32F texture).
- `lib/world/input.ts`: mouse/finger to wake.
- `lab/lava/shoot.mjs`: deterministic frames in the real engine (clock held, CDP mouse/touch, stepped at 60 Hz).
- `lab/lava/tools/blackbody.mjs`: Planck x CIE 1931 table generator (used by the first prototype; look's Planck is used now).

## Decisions
- **No crust, ever.** The concepts' crust-plates-and-cracks lava is the "specks/dirty" Jacob rejected. Variation comes only from physics, never from a noise texture:
  - emission obeys Kirchhoff, (1 - F) x Planck;
  - a thin cooling skin is seen through 1/cos, so faces toward the eye glow and the far sea cools;
  - long-wave troughs stretch the skin (hotter);
  - look's smooth currents.
- **One material with look.** The near sea reads `look_seaTemp`, `look_planck` x `look_uLavaGain` and `look_sunLight`, and blends into `look_planetFarMod` by `look_farMix`. Temperature offsets are small (skin 30 K, stretch +-36 K, wake +60 K) because true Planck makes +-30 K about 2x in brightness.
- **Swell:** 24 deep-water waves (0.9-320 units).
  - Directions spread wider for short waves, never mirrored pairs (pairs made a lattice).
  - The v component is quantised to whole cycles per lap (2 PI R), so the sea is seamless at the loop.
  - Each wave is filtered by the pixel's footprint ellipse (anisotropic). What can't be resolved becomes roughness (LEAN), so the far sea is a glitter path, never aliasing.
  - It fades out between h 150 and 900, so orbit shows look's currents instead of stripes.
- **Reflections:** the reflected ray's cone is the pixel's own (/ graz) plus sqrt(alpha^2). Stars are then averaged instead of glinting as white specks (seen and fixed in engine frames).
- **Sun glint:** GGX with the unresolved slope variance and the sun disc folded in. It uses look's sun light after the air.
- **Wake:** the production model (`lib/liquid/wake.ts`, approved by Jacob), not Continuum's nearest-segment model:
  - the nearest-segment wake produced seams on curved paths and rings from stopped pointers, shown with a debug view in the lab;
  - samples are Gaussian-weighted along the path, so the wake is continuous by construction;
  - everything is in CSS px scaled by units-per-px where each sample was laid.
  - Hover gives 1x, drag 1.85x, finger 1.5x with a 1.2 s coast after lift, and a tap makes one ring. A resting cursor still leaves a wake while the camera moves.
  - The visitor's waves fade in below h 70 and are full below h 14 (hero h 1.7, ventures h 3.2). There are none in the cosmic shots.
- **Channels:**
  - `lava.heat`: added to look's sea temperature, +850 K per unit; negative is cooler (night).
  - `lava.swell`, `lava.calm`.
  - `lava.interact`: -1 = automatic from altitude.
- **Ventures:**
  - Monoliths reach the sea's reflections through `world_env` (their `hit`/`env` hooks).
  - Their pools glow through their own `sea` hook.
  - A press is drained from `ventureRipples` into a ring.

## Open (not done by the deadline)
- The wake reads at the lowest quality step: the stirred skin glows at least ~1150 K and its crests ~1320 K whatever the place's own cooling (the night/foreground sea at ventures is too dark for +K offsets to show). Frames: `shots/engine-ventures-stroke-q8.webp`, `shots/engine-hero-touch-iphone-q8.webp`.
- There is no dedicated `lava.night` channel. `lava.heat < 0` does the same.
- The `lib/liquid/shader.ts` port (the other pages' liquid) was not started.
- Real-GPU timing was not measured. The wake loop is bounded (<= 128 samples, box test); the swell is 24 sin/cos per pixel.
