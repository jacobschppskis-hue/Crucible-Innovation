# Role: lava (the molten sea and the boat wakes)

Jacob: "The thing that makes it look dirty is when you have dark crust plates on it. That makes it look like specks. [...]
I mean lava, but it kind of acts smooth like water and has nice coloration without sharp, dark mottled as much as lava.
Kind of smooth like water, but still molten. You still have creative control [...] just don't make it look dirty."

## Deliver (`lib/world/glsl/lava.glsl`, `lib/world/{lava,wake,input}.ts`)
- A smooth, glossy molten sea that behaves like water (long swell, dispersion, reflections of the sky and the sun, the
  thin atmosphere's colour) and glows like lava (blackbody emission, hotter in troughs/fresh surface, a soft cooler skin
  that stays smooth). No crust plates, no specks, no mottling, no flaking, no grime. It must hold up from cosmic distance
  (a glowing ocean seen from orbit, sun glint) down to the low swoops (every ripple sharp).
- Boat wakes where we swoop low: the cursor (hover = gentle wake, drag = stronger), a finger on phones (wake while
  dragging and while the page scrolls under it, momentum after lift), a tap = one clean ring. Reuse what works: the
  production model (`lib/liquid/wake.ts`, Kelvin-like V from the pointer's path) and Continuum's analytic wake. Smooth V
  lines at every speed, never beads or drops, never blocky on iPhone. Waves only where the camera is close enough
  for them to read; none in the cosmic shots.
- An idle swell that never stops.
- Later (from ~11:00, with `pages`): the same lava look in the other pages' liquid (`lib/liquid/shader.ts`), so the site is
  one world.
- Test with deterministic frames (`__clock` pause/step) and CDP touch on iPhone 15, 90/400/2000 px/s cursor strokes,
  a drag, a finger drag and a flick-scroll. Commit sheets.
