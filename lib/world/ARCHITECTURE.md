# The world: architecture and module contract

Owner: `world` (lead). Everyone else plugs in through this contract. If you need something that is not here, ask the
lead (via the coordinator) with the exact change; do not edit `lib/world/{index,engine,camera,journey,loop,compose,
quality,gl,frame,modules}.ts` yourself, except one-line registrations in `modules.ts`.

## Overview

```
app/page.tsx                 static HTML: every section is a place (data-place="..."), content readable without JS
components/world/WorldMount  after load + idle (or first use): import('@/lib/world').startWorld(root)
lib/world/index.ts           startWorld(): canvas.world (fixed, z-index -1, pointer-events none), window.__world
lib/world/engine.ts          the frame: scroll -> journey -> camera/sun -> modules.update -> scene -> bloom -> post
lib/world/loop.ts            the scroll loop (Lenis infinite + syncTouch; keyboard wraps too)
lib/world/journey.ts         places, keys, channels (camera, sun, module extras); R, LAP
lib/world/camera.ts          camera from channels; rayAt / hitSea / project / surf / surfOf
lib/world/compose.ts         stitches module GLSL into the scene shader + the post shader
lib/world/quality.ts         render-scale steps (canvas never resizes for a step), software GL detection
lib/world/gl.ts              program (errors labelled module:line), Uniforms (by name), render targets
lib/world/modules.ts         the registry (one line per module)
lib/world/defaults/*         stand-ins for look_sky / look_atmo / look_post / lava_shade / lava_env
```

One clock: the engine draws in `onFrame` of `lib/liquid/loop.ts` and registers renderer `'world'` (`window.__clock`
pause/step/settle work). One full-screen WebGL2 canvas, main thread. The scene renders into an offscreen target
(RGBA16F when float rendering exists, else RGBA8 with a `c/(1+c)` encoding) at the quality step's scale; the bloom
chain (5 half-size levels, 13-tap down, tent up, additive) and the post pass (look's `look_post`) write the canvas.

## World frame and units

- The planet's centre is the origin; radius `R = 6000` (`journey.ts`, GLSL `uR`, `#define WORLD_R`). 1 unit ~ 1 m at
  the low swoops. The journey runs round the great circle in the y-z plane. One lap `LAP = 2 PI R`.
- Surface coords `w = (u, v)`: `v = R * atan(z, y)` along the circle (wrapped to (-PI R, PI R]: seamless round the
  hero at theta 0; the seam is on the far side, theta = PI, where the journey is in orbit), `u = R * asin(-x / r)`
  across (+u = right of the travel direction). `P = (R + y) * (-sin(u/R), cos(u/R) cos(v/R), cos(u/R) sin(v/R))`.
- Float precision: |w| <= PI R ~ 18850, so `w` resolves ~0.002 units. Keep near-field detail >= ~0.02 units, or work
  in coordinates relative to something near the camera. For large-scale variation over the whole planet use `Sea.q`
  (unit sphere point, seamless everywhere).
- Everything must be periodic in laps: `frame.laps` (and the unwrapped `frame.scroll`) can jump by whole laps (a
  programmatic scroll in Lenis' infinite mode re-bases it). The camera only depends on `theta`, so a jump is invisible.

## The sun (= the mark's glowing core)

The sun is a world point, not just a direction: `frame.sun = {pos, dir, dist, R, rad}`, GLSL `uSunPos` (world),
`uSunDir` (unit, from the camera), `uSunRad` (angular radius from the camera), `uSunR` (physical radius). Journey
channels place it: `sunU, sunV, sunY` (surface coords + height; `sunV` absolute like `s`), `sunR`.
- **Near** (hero, together, the last stretch before the seam): the core hangs over the sea ~150 units in front of the
  camera, 30 up, radius 4.2 (1.6 deg): the mark floats over its own reflection with real parallax. Lighting at a point P
  should use `normalize(uSunPos - P)` (a point light; the sea under it gets ripples, glitter and falloff).
- **Far** (everywhere else): a fixed star 1e6 up over longitude 280 deg, radius 1.2e4 (0.69 deg). From the hero it
  stands ~10 deg over the western horizon, exactly where the near core hangs, so near <-> far is seamless; the night
  side runs theta 10..190, the morning terminator is at 190 (the sunrise over the limb from orbit is in `shore`), the
  day side 190..370.
- Between keys the sun's direction from the camera slerps and its distance and radius interpolate in log space, so the
  core recedes into the sky (and comes back) along its own line of sight.
- `mark` hangs the whole mark around the sun at every distance (scale = `sun.R / 4.8` mark units: the core is the
  sun); `look` draws its light (corona, glare, the atmosphere's response) and should NOT draw a second disc where the
  mark draws the core.

## The journey (places table)

Sections in page order; each is `data-place="<name>"`. Keys (`journey.ts`) anchor to `(place, f)`: `f = 0` is the
section top at the viewport top, `f = 1` its bottom at the viewport bottom (pinned sections are taller than the
viewport; their content is `position: sticky`). A place less than 1.5 viewports tall runs its f over 80% of its own height
instead (top at the viewport top -> 0.8 of it scrolled past), so its keys never collapse into a cut. A place marked on
several elements spans all of them. `frame.at(name)` = a place's pin progress 0..1 on the current scroll.

| place | owner | pin (viewports) | camera (first pass) |
|---|---|---|---|
| `hero` | mark | 1.5 | low over the sea at sunset (h 1.6), facing the sun on the horizon, stars above |
| `together` | mark | 2.6 | slow rise on the sunset: the "stronger together" moment, the mark has the sky |
| `story` | story | auto | turning away from the sun to the night sea; intro + Jacob's paragraphs 1-2 |
| `paypal` | paypal | 4.2 | high orbit over the night side (h ~2600-2900), looking down: cosmic scale (inside Jacob's chapter) |
| `story-2` | story | auto | the limb and the stars from orbit; Jacob's paragraphs 3-6 (break-out once, in place) |
| `story-3` | story | auto | Charlie: coming down over the night side |
| `ventures` | ventures | 3.2 | skimming the night sea (h ~3.2): monoliths rise; cursor/finger waves here |
| `thesis` | story | 3.2 | climbing; the planet heats 293 K -> 1811 K |
| `shore` | story | auto | the footer: sunrise over the limb from orbit, the day side |
| `dawn` | story | auto | the footer's giant wordmark: coming down to the evening terminator |
| `loop` | world | 1 (exactly the viewport) | the hero's first key, one lap on: the seam |

A module may own the camera through its place: `keys: (R) => Key[]` on the module replaces the lead's keys for every
place its keys name (sorted into the journey by scroll position; channels it does not set carry over from the key
before). Its first and last keys must meet the neighbouring places.

Channel list: `s x h yaw pitch roll fov sunLon sunLat sunSize exposure` (see `journey.ts`; `h` interpolates in log
space, segments ease with smootherstep unless the key says `ease: 'linear' | 'in' | 'out'`), plus module extras
`'<id>.<name>'` declared in the module's `channels` (defaults) and set per key. Phones: a key's `ph: {...}` overrides.
Ask the lead to change keys; to try your own, pass `keys` to `startWorld` in your lab page.

## The loop

`[data-place="loop"]` is `HeroScreen clone` (inert, aria-hidden), exactly `--world-vh` (= innerHeight px) tall and
last in the document, so Lenis' limit (`scrollHeight - innerHeight`) is its top, and scroll `limit` looks exactly like
0. Lenis runs with `infinite: true, syncTouch: true` (Lenis carries touch momentum itself: setting the scroll during a
native fling kills it on iOS/Android); `lenis.raf` is called from the one clock. Keys (PageDown/Up, Space, arrows,
Home, End) are handled by `loop.ts` so they wrap too. Anchors (`/#story`) glide to the nearest copy. Off (the page simply
ends, the copy is `display: none`): reduced motion, no JS, `?loop=0`. `html[data-loop]` is set while looping.

Rule for every module: the frame at `progress` 1 must equal the frame at 0. Anything you animate by scroll must be
back at its hero state by the end of `dawn` (or depend only on `frame.at(...)` of your own place).

## The per-frame state (TypeScript, `frame.ts`)

`update(f: Frame, u: Uniforms)` gets:

- `t, dt, frame` (seconds on the one clock; `?t=` fixes `t` and makes `dt` 0), `w, h, dpr, narrow, still`
- `scroll, scrollTarget` (unwrapped CSS px), `loopLen`, `laps`, `y` (in this lap), `progress` (0..1)
- `place {name, f}` (the place under the viewport's middle), `at(name)`, `places[name] {top, h, el}`
- `ch` (channel values), `cam {pos, r, u, f, fov, focal (CSS px), s, x, h, theta, up, along, across}`, `R`
- `sun {dir, rad}`, `quality {step, scale, q (0..1 knob), software, full}`
- `pointer {x, y, active, down, touch, lastMove}` (raw; lava's `input.ts` keeps richer trails)
- helpers: `rayAt(x, y)`, `hitSea(x, y) -> {p, w, t} | null`, `project(p) -> [x, y, depth] | null`,
  `surf(u, v, y)`, `surfOf(p) -> [u, v, y]`

Uniforms: `u.set('<id>_uName', number | boolean | number[] | Float32Array)` (vec/mat by length; matrices column-major).
Textures: `u.tex('<id>_uTex', canvasOrImageOr{w,h,data,format}, version, {linear, repeat, mips})` uploads when `version`
changes and binds the sampler. Write uniforms every frame you change them; values persist otherwise.

## The module (TypeScript, `modules.ts`)

```ts
export const mark: WorldModule = {
  id: 'mark',                       // GLSL prefix: every function/uniform starts with mark_
  glsl: markGlsl,                   // import markGlsl from './glsl/mark.glsl'  (scene pass chunk)
  hooks: ['hit', 'shade', 'env', 'sea'],
  provides: [],                     // look: look_sky/look_atmo/look_post; lava: lava_shade/lava_env
  post: undefined,                  // look only: the post-pass chunk that defines look_post
  channels: { 'mark.size': 1 },     // journey extras with defaults
  keys: (R) => [...],               // optional: the camera through the module's own place(s)
  init({ gl, u, root, software }) {},   // once (may be async)
  update(f, u) {},                  // every frame before drawing: uniforms, own DOM
  after(f) {},                      // after drawing (DOM writes)
  dispose() {},
};
```

Register with one line in `MODULES` (`modules.ts`). React components render static markup only; all scroll-driven
behaviour lives in the module's `update` (framework-free), so the single-file preview behaves exactly like the site.

## GLSL contract (scene pass)

Available to every chunk (prelude, `compose.ts`): engine uniforms `uRes uView uPx uTime uDt uCamPos uCam uFocal uR uCamH
uCamUp uSunDir uSunRad uExposure uProgress uQ uStep uStill uPtr`, constants `PI TAU EMBER BONE QUENCH` (linear),
`world_hash12 world_hash33 world_noise`, defines `WORLD_R`, `WORLD_LDR` (no float targets), `WORLD_SOFTWARE`,
`WORLD_FULL` (`?world=full`), and these structs:

```glsl
struct Ray { vec3 ro; vec3 rd; float pa; int depth; };   // pa: angular size of one render px (rad); depth 0 = camera ray
struct Hit { float t; int id; vec3 p; vec3 n; vec4 data; };  // id: ID_SKY 0, ID_SEA 1, <ID>_ID + k for module hits
struct Sea { vec3 p; vec3 up; vec3 q; vec3 eU; vec3 eV; vec2 w; float t; float fw; float graz; };
           // up = q: sphere normal; eU across (+u), eV along (+v); w surface coords; fw world units per px (footprint)
struct SeaMod { vec3 g; float heat; vec3 emit; float calm; float rough; vec4 aux; };
           // g = (height, dh/du, dh/dv) added on top of lava's own surface; heat added (lava's 0..1 scale);
           // emit added radiance; calm 0..1 stills the swell; rough adds roughness; aux free for lava + one partner
```

Engine functions any chunk may call: `world_sky(Ray)` (look_sky + every `_sky` hook), `world_env(Ray)` (secondary rays:
sky, objects via their `_env`, the sea via `lava_env`; never recursive), `world_seaT(Ray)`, `world_seaAt(Ray, t)`,
`world_seaMod()`, `world_ray(fc)`.

Hooks (implement only those you list in `hooks`; called in registry order):

| hook | signature | when |
|---|---|---|
| sky | `void <id>_sky(Ray r, inout vec3 col)` | sky pixels and reflected sky; add or composite onto the sky |
| hit | `void <id>_hit(Ray r, inout Hit h)` | every primary and secondary ray; if you hit nearer than `h.t`, set `h.t, h.id (= <ID>_ID + k, k < 16), h.p, h.n, h.data` |
| shade | `vec3 <id>_shade(Ray r, Hit h)` | your primary hits; may call `world_env` for reflections |
| env | `vec3 <id>_env(Ray r, Hit h)` | your hits seen in reflections; cheap, must NOT call `world_env` |
| sea | `void <id>_sea(Ray r, Sea s, inout SeaMod m)` | primary sea pixels, before `lava_shade`: wakes, rings, heat, channels, meniscus |
| over | `void <id>_over(Ray r, Hit h, inout vec3 col)` | after shading every primary pixel (sparks in the air, glows in front; test `h.t` for depth) |

Single-provider functions (one module; defaults until then):

| function | owner | |
|---|---|---|
| `vec3 look_sky(Ray r)` | look | sky: stars, atmosphere (thin, low; a limb line from orbit), the sun disc and corona |
| `vec3 look_atmo(vec3 col, Ray r, Hit h)` | look | aerial perspective over every primary pixel (h.id == ID_SKY for sky) |
| `vec3 look_post(vec2 uv, vec2 fc)` | look | post pass: `world_scene(uv)` (linear HDR), `texture(uBloom, uv)`, uniforms `uRes uCanvas uTime uBloomOn uQ uStill`; tone curve, grain; returns display sRGB |
| `vec3 lava_shade(Ray r, Sea s, SeaMod m)` | lava | the sea's radiance (its own swell + `m`), reflections via `world_env` |
| `vec3 lava_env(Ray r, Sea s)` | lava | the sea seen in reflections; cheap, no `world_env` |

Bloom threshold: set `look_uBloomThresh` (default 1.0, linear) from look's `update`.

Output of the scene pass: linear HDR radiance (exposure applied by the engine: channel `exposure`, stops).

## Quality

`SCALES` (render px per CSS px) `[2, 1.6, 1.33, 1.1, 0.9, 0.75, 0.62, 0.5, 0.4]`, never above the device's DPR (cap 2).
Real GPUs start one step below their top; software GL starts at 0.5. Slow frames (EMA > 1/45 s for 0.8 s) step down;
fast (< 1/57 s for 4 s) climb, at most twice. `uQ` / `frame.quality.q` is the 0..1 knob for your own work (octaves,
march steps). Nothing adapts while a harness holds the clock. `?q=<step>` pins, `?world=full` pins the top at full
fidelity. The canvas itself is CSS px x min(DPR, 2) and only resizes with the viewport.

## Test hooks

- `window.__world`: `state()` (progress, y, laps, place, ch, cam, sun, quality, modules, places), `go(progress)`,
  `goPlace(name, f)`, `hold()`, `step(ms)`, `resume()`, `engine` (the live engine: `frame`, `uniforms`, `composed`).
- `window.__clock` as before (`pause`, `step`, `settle`, `renderers()` includes `'world'`).
- URL: `?t=<s>` fixed scene clock, `?q=<step>`, `?world=full`, `?still` (reduced motion), `?loop=0`, `?motion` (ignore
  the reduced-motion preference).
- DOM: `html[data-world]` (the home page is mounted), `html[data-world-on]` (the engine runs), `html[data-world-fail]`
  (why it could not), `html[data-loop]`, `canvas.world[data-path="main"]`.

## Preview

`npm run world:preview` (after `npm run build`) writes `world/dist/crucible.html`: the built home page's static HTML,
all CSS and fonts inline, and one esbuild bundle of `world/preview-entry.ts` (startWorld + every module + the few
vanilla behaviours the page needs). It must render inside `plan/final/artifact-frame-head.html` (which sets
`body{background:#fff}`: the page sets its own).

## Lab pages

Prototype in `lab/<role>/`. To run your module inside the real engine before it is registered:
`startWorld(document.body, { modules: [...MODULES, yourModule], keys: () => yourKeys })` from a page that has the
places you need (copy `lab/world/stage.html`).
