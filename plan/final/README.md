# The final build: one world, around the planet and back

Started 2026-11-08 07:00 UTC. Jacob is asleep; he looks at it in about 8 hours (target: everything done by 14:30 UTC,
preview + PR ready by 14:45). A coordinating session (`session_01PrrUSitYmSR7aDjHHAhibr`, "the coordinator") reviews,
merges and publishes previews. You are one of several Claude Code sessions building it together on ONE branch.

## Read first (in this order)
1. `plan/final/JACOB.md`: everything Jacob has liked and disliked, newest first. Tonight's answers win over anything
   older. It is written on the coordinator's branch: `git fetch origin claude/inspiring-allen-sz5kjl && git show
   origin/claude/inspiring-allen-sz5kjl:plan/final/JACOB.md`. If it is not there yet, it lands within ~30 min; read it then.
2. This file, then your role file `plan/final/roles/<role>.md`.
3. `CLAUDE.md` (architecture of the current site and the brand rules), `.claude/skills/unslop/SKILL.md` (design rules).
4. The two concepts this build combines (read their NOTES and the code you need):
   - Airless: `git show origin/claude/inspiring-allen-sz5kjl-concept-airless:concepts/airless/NOTES.md` (and `index.html`)
   - Continuum: `git show origin/claude/inspiring-allen-sz5kjl-concept-continuum:concepts/continuum/NOTES.md` (and
     `index.html`, commit 43f1197). Published previews: Airless https://claude.ai/artifact/73TNFfSGwvGx6TQFoZ2yv7,
     Continuum https://claude.ai/artifact/9Sj9TagQJYFev58gt8t9z4 (you cannot open them; the code is the same).

## What Jacob asked for tonight (verbatim, then decided)
> "Combine Airless with the hero from Continuum because it has the sunset, but we also want it to go around the planet.
> Fix the animations, like the one where it goes from PayPal to the other companies. Explain that a little bit more and
> make it so it has a better animation. We want to make it a loop like igloo.inc, so that once you scroll to the bottom,
> it puts you back at the top again. Just go through everything and make all of the animations work perfectly. Make sure
> it'll work on mobile. [...] Also, fix the liquid on the surface. Make it look a little bit better, a little cooler, more
> like lava. Less dirty. Make sure all the colors work. Make sure everything flows nicely. Make sure all of the text is
> seamlessly integrated. Make sure there aren't any backgrounds to make the text pop that are messing with the renditions
> of the waves or anything. [...] the person (not the model) [...] still looks pretty bad. You can redesign that animation
> entirely [...] come up with a better way to articulate that point that they're stronger together, rather than taking it
> apart, because it kind of looks tacky. So just take the best parts of Airless and the best parts of Continuum and put
> them all together to make the ultimate final product."

His answers to the coordinator's questions (verbatim excerpts):
- **Scale.** "It should feel like it's on an astronomical scale, like you're actually on the outside of a planet and
  everything is big. Research how the creators of Dune made everything feel really big, and how angles make things feel
  big. Also, how detail [...] makes everything feel massive. Learn how to add scale through contrast and colors and
  detail. It should feel cosmic. It should feel huge, while still having good animations."
- **Waves where they belong.** "If you think it would be better, you can remove the waves on some of the spots. In some
  spots, like where it swoops down over the ocean, you can include the cursor animations, like on the ocean when it
  zooms in. However, it should feel cosmic scale in certain parts."
- **Atmosphere and sky.** "It should have a low atmosphere as well. The continuum is just lower down where you can see the
  atmosphere, whereas if you zoom out, you see less of it. Incorporate parts of both so that you can see part of the
  sunset, but also fading into stars for the hero."
- **Journey.** "Incorporate all of them so that you can zoom in and the cursor can make waves, but when you zoom out, it's
  like cosmic scale. Then you can, at certain points, see the sunset, and also you get the cosmic scale orbit kind of
  thing." (Coordinator's frame: sunset in the hero, around the night side, sunrise at the end, which IS the hero again.)
- **Lava.** "The thing that makes it look dirty is when you have dark crust plates on it. That makes it look like specks.
  [...] I mean lava, but it kind of acts smooth like water and has nice coloration without sharp, dark mottled as much as
  lava. Kind of smooth like water, but still molten. You still have creative control [...] just don't make it look dirty."
- **Stronger together (replaces "Not the person / Not the model / Neither, alone").** "Find a way to explain it without
  taking the logo apart. Find a way that best fits with what kind of animations the site already has, what the theme is,
  and how to best incorporate it. [...] don't do something that you won't be able to do without it looking tacky. Having
  it come apart, for example, would be pretty much impossible to do without it looking tacky [...]. So, find a way that
  complements it."
- **PayPal.** Direction: "six sparks across the planet, but you better execute it well. You have to find a way that makes
  it actually work, because this is very easy for you to mess up. It ends up looking very dumb, it doesn't fit with the
  website, and it doesn't fit with the look of the planet. So just find a way to do it properly. Ways that you can
  incorporate different objects into the transition, ways that you can make the spreading [...] fit better with the
  aesthetic of the website." Explanation: step by step, captions from his own story text (eBay buys PayPal in 2002 →
  its people found YouTube, LinkedIn, Yelp, Palantir → Elon funds SpaceX, then Tesla → "so much came out of a single
  company"). No facts that are not in `data/story.ts`.
- **Ventures.** "The metal monoliths rise out and they're made of metal, but shiny, shiny slightly, but maybe still glowing
  near the bases. Make it actually look like metal and good, not like the slop that you've previously generated where it
  looks really dumb and has flaking on it."
- **Loop.** Seamless everywhere, desktop AND phones: the last scene flows into the hero with no visible jump.
- **Hero logo.** The glowing core IS the sun; the mark (Jacob's logo family, `lib/splitRing.ts`) hangs around it as a huge
  cast structure. Never taken apart, never scattered.
- **Thesis** stays ("An alloy is stronger than its metals", the readout 293 K to 1811 K) as the planet heats.
- **Founders' stories** stay in full (Jacob first), with the CRT "No signal" placeholder portraits; Jacob's line "I want to
  know what happens when a group like it comes together earlier." set ONCE, in place, at display size.
- **Copy:** rewrite freely anywhere on the home page, but every fact comes from his text; the founders' stories stay word
  for word. No fabricated testimonials, stats, clients.
- **No sound.**
- **Other pages** (/sites, /work, /ventures/*): keep content and layout, give them the new look (nav, footer, colours,
  the lava liquid) so the site is one world.
- **Destination:** the real Next.js site, as a PR he merges in the morning (nothing goes live tonight), plus a preview link.
- **Mobile is THE target.** "It is imperative that this works on mobile. It must work on mobile. It must be just as good
  on mobile so I can show it to people, because you can pull your phone out, but it's more difficult to pull your
  computer out [...]"
- **Render quality.** "You can spend all the time you need rendering these because I'm going to be asleep and you have
  all night. These need to be detailed renders that actually look good, because if it's low quality and it looks
  animated (like it looks like something in a video game), it doesn't work. It ruins the whole aesthetic. So it has to
  be proper."

## The quality bar (every role, every commit)
- **Film, not a video game.** Physically motivated light (energy-conserving, real falloff, real Fresnel), a proper
  tone curve (filmic/AgX/ACES-like, no clipped hues), atmospheric perspective, depth, micro detail that resolves (never
  aliasing, never mush), subtle grain, no flat gradients, no plastic specular, no "shader toy" noise patterns, no visible
  tiling, no banding. If a frame would look at home in a mobile game, it fails.
- **Cosmic scale** where the journey is far out; intimate, touchable scale where it swoops low over the sea. The
  transitions between them are continuous camera moves, never cuts.
- **Mobile first.** Design every scene for 390×844 portrait first, then widen. Test as iPhone 15 (Playwright
  `devices['iPhone 15']`) and 1440×900 at every milestone, with real touch input (CDP `Input.dispatchTouchEvent`), and
  budget for an iPhone GPU (see QA's perf proxy). If something can't be as good on a phone, redesign it until it is.
- **No masks, scrims, halos or boxes behind text.** Legibility comes from composition and camera framing (dark sky,
  calm night sea, the type placed where the world is quiet), never from a darkened rectangle, a glow or a text-shadow
  smudge. Waves and light pass under text untouched.
- **Clean lava.** Smooth, glossy, water-like molten surface with rich blackbody colour. No dark crust plates, specks,
  mottling, flaking, grime or "dirty" noise anywhere (lava, monoliths, castings).
- **Never take the logo apart.** The mark is always whole (Jacob's family geometry, `lib/splitRing.ts`, `tests/mark.spec.ts`
  rules: 7 + 4 upright squares, arcs ending on the core's centre line, one empty step).
- **Every animation is continuous and scroll-reversible**: no jerks, no pops, no sudden endings, nothing left sitting
  (no stray lines, no orphaned sparks), no dead screens (never more than ~0.3 viewport of scroll with nothing to look at).
- **Brand:** colour means temperature. Ember (#FF5B1F) is the only hot accent, about three Ember things per screen;
  Quench (cool blue, ~#8DB6F2) only for cold things (stars, the cool sky band, a cold readout), ~5% at most; bone
  (#E8E4D8) for cooled metal and text. Archivo only (no second display face, no monospace except real data), no gradient
  text, no wide-tracked caps, no decorative numbering. Never write "LLC", addresses or payment details.

## Architecture (the contract; the `world` lead writes the exact signatures in `lib/world/ARCHITECTURE.md` by ~08:00 UTC)
- **Engine:** `lib/world/`: framework-free TypeScript, no React imports, no three.js (raw WebGL2, like `lib/gl3d`). One
  full-screen canvas behind the page (fixed, `z-index:-1`, `pointer-events:none`) that paints the whole world; the DOM
  (text, links, buttons) sits above it, transparent backgrounds everywhere. Entry `startWorld(root, opts)`. It reads the
  page's sections by data attributes (like the concepts do) so the same engine drives both the Next.js page and the
  single-file preview.
- **One clock:** use the site's clock `lib/liquid/loop.ts` (`onFrame`, `window.__clock` pause/step/settle/renderers) so
  every test tool keeps working; workers draw exactly the `t` they are posted.
- **Modules:** every feature is a module registered in `lib/world/modules.ts` (one line each). A module owns its GLSL
  functions and uniforms and a `update(frame)` hook; the lead's composer stitches the shader and calls each module's
  documented entry points. Until the contract lands, prototype in `lab/<role>/` (standalone pages, anything goes), then
  port into your module.
- **Journey:** scroll maps to one progress value through keyframed places (each section is a place on the planet: an
  altitude, a heading, a sun position). Camera follows with a critically damped spring. The loop wraps progress: the
  end of the journey is the start of the journey.
- **Page:** `app/page.tsx` renders all content as static, readable HTML (server components). A tiny client component
  mounts the engine after load + idle (or first use). The headline and nav never wait for WebGL. Reduced motion, no JS
  and no WebGL get a designed still version (pre-rendered stills from our own renderer).
- **Preview:** `npm run world:preview` (the lead adds it) bundles the built home page into ONE self-contained HTML file
  (`world/dist/crucible.html`: inline CSS/JS/fonts, workers from blob URLs, images inline or tiny) that renders inside
  the claude.ai artifact frame. That frame (`plan/final/artifact-frame-head.html`) sets `body{background:#fff;color:#000}`:
  the page must set `body{background:transparent;color:<bone>}` itself or it shows white.
- **Hooks for testing:** `window.__world = { state(), go(progress), hold(), step(ms) }`, `?t=<s>` fixed clock,
  `?q=<step>` fixed quality, `?world=full` top quality (screenshots), `?still` reduced motion.

## How we work on one branch (trunk: `claude/inspiring-allen-sz5kjl-final`)
- Everyone commits to the trunk. Commit small and often; `git pull --rebase origin claude/inspiring-allen-sz5kjl-final`
  before every push; never force-push, never rewrite or revert someone else's commits.
- **Own your files** (see the table). Do not edit another role's files; if you need a change there, send the owner (via
  the coordinator) the exact diff. One-line registrations in `lib/world/modules.ts`, new files under your own folders and
  your own CSS files are always fine.
- Never push a broken build: `npm run typecheck` and the world smoke check (`npm run world:smoke`, QA adds it) must pass.
- Commit renders/frames you want reviewed as small webp under `lab/<role>/shots/` (keep each < 300 KB).
- **Report to the coordinator** with the remote-session `send_message` tool (session `session_01PrrUSitYmSR7aDjHHAhibr`):
  when your contract/prototype is ready, at each milestone, when blocked, when done. Keep it short: what changed, the
  commit, the frames to look at (paths), what you are unsure about. The coordinator may answer with fixes; do them first.
- Do not merge to main, do not open PRs, do not deploy. Do not ask Jacob anything (he is asleep): decide, note the
  decision in your role's NOTES (`lab/<role>/NOTES.md`), move on.
- Research before designing (Awwwards/Godly/Shadertoy/papers/film references), but timebox it (≤ 30 min) and write the
  takeaways in your NOTES.

## The team (sessions are listed in `plan/final/TEAM.md` once started)
| Role | Owns (files/folders) | Job |
|---|---|---|
| `world` (lead) | `lib/world/{index,engine,camera,journey,loop,compose,quality,gl,frame}.ts`, `lib/world/modules.ts`, `lib/world/ARCHITECTURE.md`, `app/page.tsx`, `components/world/WorldMount.tsx`, `world/` (preview build) | The engine, the journey (cosmic orbit ↔ low swoops), the seamless loop, integration of every module, mobile scroll |
| `look` | `lib/world/glsl/{sky,atmosphere,planet,sun,post}.glsl` (+ `.ts` wrappers), `lib/world/look.ts`, `lab/look/` | Look development: the planet at cosmic scale, the thin atmosphere (visible low, a limb glow from orbit), sunset → stars, the sun/core light, tone curve, grain, bloom; the film quality; scale (Dune research); any offline pre-render pipeline |
| `lava` | `lib/world/glsl/lava.glsl`, `lib/world/{lava,wake,input}.ts`, `lab/lava/` | The smooth molten sea up close and far away, its idle swell, cursor and finger boat wakes where we swoop low; later the same lava look for the other pages' liquid (`lib/liquid/shader.ts`) |
| `mark` | `lib/world/glsl/mark.glsl`, `lib/world/{mark,together}.ts`, `lab/mark/`, hero copy in `data/home.ts` (new) | The hero: the core is the sun and the whole mark hangs around it (cast metal, lit by its own sun); the new "stronger together" moment that replaces the take-apart beats |
| `paypal` | `lib/world/glsl/paypal.glsl`, `lib/world/paypal.ts`, `components/world/PayPal*.tsx`, `lab/paypal/` | PayPal → six sparks across the planet → six companies, with step-by-step captions |
| `ventures` | `lib/world/glsl/monolith.glsl`, `lib/world/ventures.ts`, `components/world/Venture*.tsx`, `lab/ventures/` | Three metal monoliths rising out of the lava (real metal, slightly shiny, glowing near the base), links that work by tap |
| `story` | `components/world/{Story,Chapter,Thesis,Footer}*.tsx` + their CSS, `lib/world/{thesis,type}.ts`, `lab/story/` | The founders' chapters with CRT placeholders, the Thesis heat (293 K → 1811 K), how all text sits in the world (no scrims), the footer/shore that hands over to the loop |
| `pages` | `components/{Nav,Footer,MobileMenu}.tsx`, `app/{sites,work,ventures}/**`, `components/Sites*`/others outside `components/world`, `lib/liquid/*`, `app/globals.css`, `CLAUDE.md`, `README.md` | The rest of the site in the new style; production integration (tests, Lighthouse, stills, docs) at the end |
| `qa` | `tests/**`, `world/smoke*`, `lab/qa/`, `package.json` scripts it adds | The test harness (iPhone + desktop, touch, loop, artifact frame, reduced motion, no JS, overflow, dead zones, perf proxy) and continuous review; files findings to the coordinator |

## Milestones (UTC)
- 07:10 sessions start. Research (≤30 min) + lab prototypes. `world` lands the skeleton and `ARCHITECTURE.md` by ~08:00.
- 08:00–11:30 build into the trunk. The coordinator reviews every ~45 min and publishes preview links.
- 11:30–13:30 polish, mobile, performance, every frame; QA finds, owners fix.
- 13:30–14:30 production checks (typecheck, build, Playwright, Lighthouse ≥ 95 mobile on all four categories, /sites
  first-load JS well under 200 KB gz, no horizontal scroll at 360 px, AA contrast), docs, final preview.
