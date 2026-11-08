# The final build: one world around a molten planet

## What changed, for Jacob

**The home page is one world.** It opens on Continuum's sunset: low over a smooth molten sea, the glowing core of your mark is the sun, and the whole mark hangs round it as cast metal (never taken apart), with the sky fading from the sunset into stars. As you scroll, the camera travels round the planet. It swoops low over the sea where your cursor or finger leaves boat wakes, and climbs to orbit for the cosmic-scale parts. It ends on a sunrise over the planet's edge, then comes back to the exact first frame: the page loops like igloo.inc, on desktop and phones.

- **Stronger together** replaces "Not the person / Not the model / Neither, alone": two runs of metal fill your mark round the sun, one down the arcs and one square by square, and meet. Nothing comes apart.
- **PayPal** is six sparks across the planet seen from orbit, explained step by step with captions taken only from your own story text.
- **Ventures** are metal monoliths rising out of the lava: slightly shiny metal, glowing near the base. Crucible Sites carries the mark; each one opens by tap on a phone.
- **The Thesis** keeps "An alloy is stronger than its metals" and heats the sea from 293 K to 1811 K. Both founders' stories are there word for word (yours first), with the CRT "No signal" placeholders, and your line "I want to know what happens when a group like it comes together earlier." appears once.
- **Clean lava:** smooth and glossy like water, glowing like molten metal. No dark crust plates, specks or mottling anywhere.
- **No boxes, masks or glows behind any text.** The words sit where the world is quiet.

**The other pages match** (/sites, /work, /ventures and the venture pages keep their content and layout):
- The background is the same lava seen from straight above: near-black and glossy at rest, so text stays easy to read. A few faint warm lines catch the light, and your cursor or finger leaves thin glowing lines that fade in about three seconds.
- /ventures and the Verge and Trellis pages show the new metal monoliths instead of the old bars, and their share images are rebuilt from them.
- /work's "This site" screenshots show the new home page.

**Phone fixes along the way:**
- On 360-375 px phones the "Get a quote" button in the /sites header was cut off at the edge; it fits now.
- A sideways finger swipe on /sites (to make waves) could send Chrome back to the previous page; it no longer does.

## Checked (all on the final branch)
- `npm run typecheck` and `npm run build` pass. First-load JavaScript (gzipped): /sites 129 KB (budget well under 200 KB), / 116 KB, /work 111 KB, /ventures 111 KB.
- `npm test` (Playwright, Pixel 7 and 1440 × 900): 96 passed, 6 skipped, 0 failed.
- `npm run world:smoke` (iPhone 15 and 1440 × 900): the world starts after a real touch or mouse move, frames are neither black nor white along the journey, and the loop seam matches (the last frame equals the first).
- Lighthouse mobile (performance / accessibility / best practices / SEO):

  | Page | Scores |
  |---|---|
  | / | 99 / 100 / 100 / 100 |
  | /sites | 96 / 100 / 100 / 100 |
  | /work | 97 / 100 / 100 / 100 |
  | /ventures | 99 / 100 / 100 / 100 |
  | /ventures/verge | 99 / 100 / 100 / 100 |

- No sideways scroll at 360 px on any page (including the 404).
- The /sites background behind text stays dark at rest (relative luminance ≈ 0.005 typical), so body text keeps AA contrast.
- Touch was tested with real touch events (Chrome DevTools Protocol) on an emulated iPhone 15: finger wakes, scrolling with momentum, and taps.

## Not verified yet
- **A real iPhone GPU.** Every frame here was rendered with software GL (SwiftShader) in Chromium. Frame rate, heat and battery on a real phone are untested, and so is how fast the quality steps settle there.
- **Safari / WebKit.** The Playwright runs are Chromium only, and iOS Safari's own scrolling momentum through the loop has only been emulated.
- **Lighthouse without a GPU** doesn't see the moving world: without a GPU the world starts on the first touch, scroll or mouse move. Visitors with a GPU get it after the page loads, as before. The scores above are for what loads first: the headline and the still hero.
- Real photos for the CRT portraits, Verge's and Trellis's own marks, the FAQ answers and the client-site slots are still `TODO(jakob)`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01PrrUSitYmSR7aDjHHAhibr
