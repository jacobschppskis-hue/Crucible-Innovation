# Role: ventures (the metal monoliths)

Jacob: "The metal monoliths rise out and they're made of metal, but shiny, shiny slightly, but maybe still glowing near
the bases. Make it actually look like metal and good, not like the slop that you've previously generated where it looks
really dumb and has flaking on it."

## Deliver (`lib/world/glsl/monolith.glsl`, `lib/world/ventures.ts`, `components/world/Venture*.tsx`)
- Three monoliths (Crucible Sites: live, cooled cast metal with Jacob's mark and its orange core; Verge and Trellis:
  coming soon) that rise out of the smooth lava as the journey reaches them, huge (cosmic scale: see `look`), lava
  draining off them as they rise.
- Real metal: physically based (GGX microfacets, correct conductor Fresnel, reflections of the actual scene: sky, sun,
  sea glow), a subtle cast/brushed micro-surface that never reads as noise, bevelled edges catching the light, slight
  shine, a blackbody glow near the base that fades up the metal (hotter = brighter/whiter, cooling to dull red then to
  bare metal). No flaking, no crust, no blotches, no outlines.
- Each venture's name and info as real text next to its monolith (Archivo); the whole monolith + text is one link
  (Crucible Sites → /sites, Verge → /ventures/verge, Trellis → /ventures/trellis), obviously clickable, works by tap.
- Hover/focus/press: the monolith answers (heat rises in it, it lifts a little), with a ripple in the sea.
- iPhone first. Commit frame sheets of rest/hover at 390×844 and 1440×900.
