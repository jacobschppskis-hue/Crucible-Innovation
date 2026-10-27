# Good morning

Everything from last night is on the branch `overnight/award-build`, in the draft PR **[#11](https://github.com/jacobschppskis-hue/Crucible-Innovation/pull/11)**. Nothing went to `main`, so the live site hasn't changed. CI (typecheck, build, 52 Playwright tests, Lighthouse) is green.

## What was built

### "/": the first impression

- **Ignition (the opening).**
  - The Ember core sparks, a thin streak of light crosses it, and a heat pulse rolls out.
  - The arcs draw and the pixels are stamped in hot, then cool to bone.
  - "Intelligence, / alloyed." rises out of its masks in big two-line type. "alloyed." arrives white-hot and cools.
  - On desktop, callouts in the style of a technical drawing label the halves "Human · Continuous lines" and "Machine · Pixels" (your words from the story).
- **First scroll.** The headline parts and the *same* ring tells "Not the person. / Not the model. / Neither, alone.":
  - the machine half scatters;
  - then the human half leaves;
  - then they fuse and the core flares.

  It is one continuous object rather than a hero followed by a separate section. This replaces the old hero and FusionStory.
- **Your story** warms from dim to bone, word by word, as it's read.
- **Ventures.** A concept site is poured into the Crucible Sites card as it scrolls in. The two "forging" ventures show a half-forged Split Ring whose core isn't lit yet (only a live venture gets its Ember core).
- **Thesis** (293 K → 1811 K). A furnace glow rises from the floor as the temperature climbs.
- **Footer.** The giant wordmark's Ember dot only lights once it has fully risen.
- **404.** The Split Ring "at 0 K": pixels drifted loose, the core out.

### "/sites": showing what we build

- **The hero frame is a live website, not a screenshot.** The three concept sites (café, barbershop, landscaper) were rebuilt as real, responsive HTML. On load the café is *cast*: its blueprint pours in from the top, and the finished site follows behind an Ember heat front.
- **First scroll.** The hero copy gives way to three captions:
  - **01 · Every screen:** the browser frame turns into a phone and the site really reflows.
  - **02 · Every business:** the same frame is recast as the barbershop, then the landscaper.
  - **03 · Then it's yours.**

  Everything stays labelled "Concept".
- **Further down,** your and Charlie's ASCII portraits are cast in behind the heat front, like an engraving being printed.
- **Between pages,** clicking a link between `/` and `/sites` pours the next page in. The browser's back button stays ordinary.

### Two tiers

- **Light** is the default: CSS, SVG and canvas. It is what Lighthouse, slow phones and Save-Data get.
- **Rich** adds WebGL on capable devices only:
  - the Split Ring becomes ~10k particles (flowing arcs, pixels that break into grains, a white-hot core throwing sparks, a cursor that stirs the metal);
  - the Thesis becomes a surface of iron that goes from glowing cracks to flowing molten metal at 1811 K;
  - sparks fly off the heat front on `/sites`.
- **How the tier is chosen:**
  - An instant guess before first paint.
  - Then, once the page is loaded and idle, a real check: a WebGL context with no software renderer, download speed measured from the site's own files (which works in Safari), and a short frame-rate probe.
  - WebGL code is only downloaded once the check passes. Each scene lowers its quality, then falls back to the light version, if a device can't keep up.
- Reduced motion, no JavaScript and short landscape screens get calm, finished layouts.

### Numbers

| | `main` | this branch |
|---|---|---|
| Lighthouse mobile performance (local, interleaved runs) | / 93–97, /sites 91–96 | / 92–94, /sites 92–94 |
| Accessibility / Best practices / SEO | 100 | 100 |
| First-load JS | / 112 KB, /sites 122 KB | / 114 KB, /sites 127 KB |
| Playwright tests | 20 | 52 |

CI's Lighthouse run passes every assertion, including performance ≥ 90 on both pages.

## How to see it

- **Recordings:** the PR description has GIFs of every key animation. Smoother MP4s are in `overnight/media/`.
- **Preview locally:**
  ```bash
  git fetch origin && git checkout overnight/award-build
  npm ci && npm run build && npx serve out
  ```
  Then open http://localhost:3000 and http://localhost:3000/sites.
- **Force a tier:** add `?tier=rich` or `?tier=light` to the URL. Use `?tier=rich` to see the WebGL versions on any machine.
- **See the full opening again:** after your first visit in a tab, `/` plays a quicker version of the opening. Open a new tab or a private window to see the full one.
- **Your phone:** CI doesn't deploy previews. To check on a phone, run `npx serve out` and open your computer's local IP address from the phone on the same Wi-Fi.

## Decisions to review

1. **Live concept sites instead of screenshots in the /sites hero.**
   - They use the site's own fonts (Archivo, Instrument Serif), not the concept pages' Fraunces/Anton/DM fonts, so no extra fonts download.
   - The barbershop headline is Archivo ExtraBold rather than Anton.
   - The screenshots are still used by Before/After and the Work cards.
2. **New copy on /sites** (stage captions). No new claims, just existing promises reworded:
   - "Built for the phone in their pocket." / "Mobile-first. Every layout is drawn for the phone first, then opened up for the big screen."
   - "Not a template." / "Same week, different business. Every concept here began as a blank page, not a template."
   - "Then it's yours." / "Your domain, your content, live in about a week. No payment until you've approved the design."
3. **New labels on /:** "Human · Continuous lines" and "Machine · Pixels" beside the ring (desktop), from your description of the logo.
4. **The forging ventures' cores are unlit.** Only the live venture gets Ember. It's a nice metaphor, and it keeps the Ember count down.
5. **Rich tier on phones.** Allowed when a phone passes the checks (recent iPhones will). Phones get fewer particles and a lower resolution.
6. **Recordings in the repo.** About 14 MB of GIFs and MP4s live in `overnight/media/` so the PR can show them. They're not part of the site. Delete `overnight/` after merging if you don't want it in the repo; the PR's images point at a fixed commit, so they keep working.
7. **Branch name.** The session was set up for a `claude/…` branch, but you asked for `overnight/award-build`, so everything is there.

## Known issues

- Rich-tier visuals were checked in a GPU-less browser (SwiftShader), which is slow but renders correctly. Real-device frame rates weren't measured. Each WebGL scene watches its own frame times and steps down or falls back if needed. **Please open the site on your Mac and iPhone and see how the rich tier feels.**
- Local Lighthouse scores vary by a few points between runs. CI is the reference.
- On phones the nav still has no menu (logo and "Get a quote"/"Start a project" only), as before.

## Going live: one step

Merge [PR #11](https://github.com/jacobschppskis-hue/Crucible-Innovation/pull/11) into `main` (mark it "Ready for review", then merge). The existing deploy workflow builds the site and publishes it to GitHub Pages automatically.

## Where things are

- `components/Ignition.tsx`: the home opening.
- `components/BuildStage.tsx` and `components/LiveSite.tsx`: the /sites opening and the live concept sites.
- `lib/tier.ts`: tier detection. `lib/gl/`: the WebGL scenes (`ringParticles.ts`, `molten.ts`, `sparks.ts`).
- `components/Ventures.tsx`, `components/HeatText.tsx`, `components/ReadingHeat.tsx`, `components/RouteTransition.tsx`.
- `overnight/tools/`: recording and checking tools (`capture.mjs`, `record.mjs`, `shot.mjs`, `probe.mjs`).
- `overnight/PROGRESS.md`: the full log, including what was taken from which award sites.
