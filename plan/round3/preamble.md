# How this works (read first)

You are one of several Claude Code sessions working in parallel on Jacob Schopp's site, crucibleinnovation.com
(repo `jacobschppskis-hue/Crucible-Innovation`). A coordinating session (`session_01PrrUSitYmSR7aDjHHAhibr`) split
Jacob's feedback into workstreams, will merge every branch, test the whole site and report to Jacob. You own ONE
workstream, described below. Your checkout starts from branch `claude/inspiring-allen-sz5kjl` (geometry commit `0b6bc71` plus these briefs), which
already has the NEW Split Ring geometry (see "The mark" below).

Jacob is a demanding art director with a good eye. His words this round: "Make sure everything is perfect, because
oftentimes when I have you do a loop, you accept something that isn't actually very good, doesn't fit and doesn't
actually work when you're testing every individual frame and when you're using it in real life. Make sure your testing
is proper and actually tests it in a way that can verify that it is polished and finalized." and "there is no single
component that is low effort ... visually boring and not interesting and not aesthetically pleasing" is not acceptable.
So: judge your work by LOOKING at rendered frames (desktop 1440x900 and phone 390x844 with touch), frame sequences for
anything that moves, close-up crops at deviceScaleFactor 2 — not by reading your own code. Iterate until a design-award
judge would believe a top studio made it. Then iterate once more.

## Setup and tools
- Read `CLAUDE.md`, `README.md` and `.claude/skills/unslop/SKILL.md` (design rules) before changing anything.
- `npm ci`, `npm run build` (static export to `out/`), `npm run typecheck`.
- Playwright: the npm-pinned browser is missing in this container; use the preinstalled one:
  `export PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome` (tests read it), and in your own scripts
  `chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'] })`.
  WebGL only exists through SwiftShader (software, slow): pin quality with `?liquid=full`, and use the test hooks for
  deterministic frames: `window.__clock` (`pause()`, `step(ms)`, `resume()`, `settle(t)`), `window.__liquid`,
  `window.__float.list()`, `window.__logo`. Serve the build with `npx serve out -l 4173 --no-clipboard`.
- `npm test` runs all Playwright smoke tests against `out/` (phone + desktop projects); `npm run unslop` the design checks.
- 4 CPUs and software GL: keep recordings focused (crop, fewer frames) so they finish.

## The mark (already changed at 0b6bc71; do not change it further)
`lib/splitRing.ts`: `RING = { c: 32, px: 3.6, stroke: 3.6, core: 4.5, rings: [{ r: 27, n: 9 }, { r: 15, n: 5 }] }`.
Each ring's left half is a filled band (3.6 wide) that ends exactly on the vertical line through the core's centre
(x = c): it never runs past the centre. The right half is `n` upright squares (3.6) centred exactly ON the circle, evenly
spaced in angle (`step(n) = π/(n+1)`, square k at angle -π/2 + k·step), so between each band's end and its first square
there is one empty step: a visible break. 14 squares total, no "welded" cells, no lattice. `cells()` returns
`{ x, y, ring, k, a }`; `arcOutline(r)`, `outlinePath(inset)`, `splitRingSvg()` as before. The 3D logo
(`lib/gl3d/geometry.ts logoPieces()`: 2 arcs, 14 squares, the core) and the Crucible Sites ingot stamp already use it.

## Rules
- Stay inside your workstream's files. Shared files (`app/globals.css`, `lib/gl3d/materials.ts`, `lib/gl3d/core.ts`,
  tests) get small, local edits only, so the coordinator's merge stays clean. Do NOT edit `CLAUDE.md` or `README.md`:
  instead, end your report with the exact doc changes you'd make (the coordinator writes the docs once, after merging).
- Brand rules from CLAUDE.md still hold unless Jacob's words below override them: no "LLC"/address/payment details, no
  fabricated testimonials/clients/stats, Ember is the only accent and means hot, no gradient text, no second display
  face, placeholders marked `// TODO(jakob)`, Lighthouse mobile >= 95, `/sites` first-load JS well under 200 KB gzipped,
  no horizontal scroll at 360 px, AA contrast, visible Ember focus rings, reduced motion and no-JS fallbacks.
- Founders' words in `data/story.ts` are theirs: never edit their sentences.
- Commit in logical steps with clear messages, each ending with these two lines:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01PrrUSitYmSR7aDjHHAhibr`
  Never put a model name in commits or code.
- Push to YOUR branch only (named below). Do NOT open a pull request: the coordinator merges your branch into its own PR.

## When you are done
1. `npm run typecheck`, `npm run build`, the Playwright tests your change touches (ideally the full `npm test`) all pass.
2. Push your branch.
3. Send the coordinator a message with the `send_message` tool (session_id `session_01PrrUSitYmSR7aDjHHAhibr`):
   what you changed (files), how you verified it (which frames/sequences, viewports, what you looked for), anything
   unfinished or risky, the doc changes for CLAUDE.md/README.md, and any question for Jacob. Keep it under ~600 words.
   If you get blocked on something only Jacob can decide, make the best call, note it in that message, and keep going.
