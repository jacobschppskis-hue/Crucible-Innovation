# How this works (read first)

You are one of four Claude Code sessions each building ONE redesign concept for Jacob Schopp's site,
crucibleinnovation.com (repo `jacobschppskis-hue/Crucible-Innovation`, checkout at branch `claude/inspiring-allen-sz5kjl`,
commit `0b6bc71`). A coordinating session (`session_01PrrUSitYmSR7aDjHHAhibr`) reviews the four, publishes them as pages
for Jacob to compare, and he picks one (or mixes parts of several) to take to production. Other sessions are fixing the
current site in parallel; you do not change the site's code at all.

## Jacob's words that apply to every concept (verbatim excerpts)
- "We're going to do another redesign for the hero. It's going to be the same ocean-looking design at the bottom [the
  footer's glowing molten surf under the giant 'crucible' wordmark, which he loves: 'waves breaking on a shoreline,
  except glowing'], along with the crucible type, except it's going to be like that at the top, and that's going to be
  like the ocean at the bottom. No shoreline, just we'll have a dark sand, like a black sand shoreline. The waves are going
  to be lapping against the shore constantly."
- "The nucleus of our logo should be like the sun in a dark mode way similar to the picture in the way that the subject is
  floating over water and making ripples." (The picture: a dark sunset over calm water; a glowing object hovers above the
  water at the centre with a thin circle (a ring) around it, a bright reflection column on the water below it, and
  concentric ripples spreading on the water beneath it. Dark, warm, cinematic.)
- "I want you to find ways to make this actually look cool and I want some light color in the sky."
- "Find a way to incorporate the current design where your cursor makes waves into the lava ocean at the top."
- "Make four versions of the website that all fit different themes, but still kind of fit with our company ... everything
  must fit a theme and all go together, and there is no single component that is low effort, like the previous PayPal
  into its different companies or the previous iron turning into steel animation. All of those are just very low effort
  things that kind of fit with the theme theoretically, but visually, they're very boring and not interesting and not
  aesthetically pleasing."
- "Come up with ways to make the text more interesting, because the venture is kind of boring. It's just white on a black
  background. Ways to make it more interesting, more accents."
- "Ways to make the ingots more interesting and fit with the page more. Maybe with the new background, the ingots
  wouldn't be so good. Maybe we could have a subject come out of the lava or be part of the lava or something."
- On the cursor: "make it so that it'll have proper smooth lines, like a boat making a wake in the water, rather than a
  bunch of drops in a line." "There should be some background movement when you're not touching the site, just slight
  waves going across the screen constantly, like an ocean. And then when you drag, it makes a more marked effect."
- On phones: "make it better for iPhone users because the touch on iPhone doesn't make it great ... it is fairly blocky,
  and it does the drops thing instead of a boat making a wake."
- On quality: "Make sure everything is perfect, because oftentimes ... you accept something that isn't actually very
  good, doesn't fit and doesn't actually work when you're testing every individual frame and when you're using it in
  real life. Make sure your testing is proper." "Try to make it the final product each time, but do not be afraid to
  reiterate and improve." "Research how Manus finds the best designs" (i.e. look at real award-winning references before
  designing: Awwwards/Godly/Codrops/Shadertoy; extract what makes them work; then design and self-critique).

## The brand (read CLAUDE.md, README.md, .claude/skills/unslop/SKILL.md, data/*.ts, components/Ignition.tsx copy)
- Crucible: a studio run by two high-school co-founders, Jacob Schopp and Charles Rochford, that builds ventures. Live:
  Crucible Sites ("Websites for local businesses, built in days.", links to /sites). Coming soon: Verge ("Find your
  verge", an AI coach for endurance athletes) and Trellis ("A day that actually fits", an AI day planner). Hero copy:
  "Intelligence, alloyed" + "Human judgment and machine range, fused into one material. Crucible is a studio that builds
  and ships ventures." The opening's story beats: "Not the person" / "Not the model" / "Neither, alone". Thesis: "An alloy
  is stronger than its metals" ("Steel is harder than iron. Bronze is harder than copper."). Founders' accounts in
  `data/story.ts` (their words, never edited; Jacob's mentions the PayPal Mafia: PayPal, then YouTube, LinkedIn, Yelp,
  Palantir, SpaceX, Tesla). Contact: jacob@crucibleinnovation.com. Never: "LLC", addresses, payment details, fake
  testimonials/clients/stats.
- The mark (new geometry, `lib/splitRing.ts`): in a 64-unit box centred at (32, 32): two rings, r = 27 and r = 15. Each
  ring's LEFT half is a solid band 3.6 wide that ends exactly on the vertical line through the centre (it never passes
  it). The RIGHT half is upright squares 3.6 wide centred exactly on the circle, evenly spaced: n = 9 on the outer ring,
  5 on the inner; square k (1..n) at angle -90° + k·180°/(n+1) (y down, -90° = top), so there's one empty step between
  each band's end and its first square. The core: a circle r = 4.5 at the centre, Ember. Human half = continuous lines,
  machine half = pixels, meeting at an orange core. Use `splitRingSvg()` / `cells()` / `arcOutline()` from
  `lib/splitRing.ts` as the reference. Wordmark: "crucıble" in Archivo with a dotless ı and an Ember dot
  (`components/Wordmark.tsx`).
- Colour: ground #0D0D0B, bone #E8E4D8 (cooled), bone-dim for secondary text, Ember #FF5B1F (hot: active, interactive,
  live; about three Ember things per screen), Ember-hot (white-hot metal only). "Colour means temperature."
  NEW, to explore: ONE contrasting cool accent, "Quench" (a cool blue around #58A6FF; tune the exact value for your
  concept: anything from a temper-steel blue to an icy cyan), used sparingly (~5% of a screen) and only for cold things
  so the colour system still means temperature: the cool fill light from above, starlight, a cold planet, the coolant, a
  cooled edge, maybe one small UI accent. It should make the Ember pop, never compete with it. Show how you use it.
- Type: Archivo only (Google Fonts, variable: wght 400..800, wdth 100..125). Poster scale: very big display, small
  labels. No gradient text, no serif accent words, no second display face, no wide-tracked small caps, no decorative
  numbering, no periods at the end of headings (see unslop). Within that, make the text interesting.
- Art direction: a foundry at night, macro lens; light comes from the hot metal; everything procedural (no stock
  photos, no photos of people: the founders' portraits are going to be "CRT" art made from photos Jacob will send later;
  use a tasteful placeholder: a CRT screen in a no-signal/test-card state with the name, no fake faces).

## Deliverable
A self-contained concept page: `concepts/<slug>/index.html` (one file: inline CSS and JS, procedural WebGL2 (raw WebGL2
recommended; if you use a library, load an exact pinned version, e.g. `https://cdn.jsdelivr.net/npm/three@0.160.0/...`,
from cdnjs.cloudflare.com, cdn.jsdelivr.net/npm or unpkg.com only), Archivo from Google Fonts; no other network
requests; under ~1.5 MB). It is a full home page in your concept, top to bottom: (1) the hero, (2) the founders' story
moment with a CRT placeholder portrait and the PayPal -> six companies moment reimagined for your theme (beautiful,
seamless, alive, no static leftover lines, no sudden endings), (3) the ventures, with the ingots reimagined (or replaced
by something that rises out of / belongs to the lava) and more interesting venture type, with an obvious hover/tap
affordance to open each venture that works on iPhone, (4) the thesis and the footer, with the glowing molten surf motif.
Nav at the top (opaque, the wordmark + Story, Ventures, Work, Sites, "Start a project").
It must: run from file:// or any static host with no build; hold 60 fps on a recent MacBook and iPhone (adaptive
resolution, cap DPR, pause off-screen work); work with touch on iPhone (finger drag on the liquid makes the wake;
scrolling keeps working and also makes a wake); respect prefers-reduced-motion (a beautiful still frame of each scene);
keep text AA; no horizontal scroll at 360 px. Also write `concepts/<slug>/NOTES.md`: the idea in 3 sentences, how the
contrast colour is used, what's real-time, what you'd do next to bring it to production, and questions for Jacob.

## Process
1. Research first (Manus-style): use WebSearch / WebFetch for 6-10 real references for your concept (award sites,
   Shadertoy, Codrops); note what makes each work. Keep the list in NOTES.md.
2. Build the hero first and get it stunning; then the rest. Every section must hold up.
3. Test like Jacob will use it: Playwright Chromium (`executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome'`,
   args `--enable-unsafe-swiftshader --use-angle=swiftshader --ignore-gpu-blocklist`; software GL is slow, so make your
   page accept `?t=<seconds>&q=<quality>` or a `window.__step(dt)` hook so you can render exact frames deterministically).
   Record: the hero idle (8+ frames over ~5 s), a scripted cursor path at slow/medium/fast speeds and a mouse drag (frame
   sequences), the phone view (390x844, `devices['iPhone 15']`) with a CDP touch drag and a touch scroll, every section
   at both sizes, and 2x crops of the details. Look at every frame. Fix what looks cheap, aliased, muddy, too busy, too
   empty, or off-theme. Repeat.
4. Commit `concepts/<slug>/` only (plus any screenshots you want the coordinator to see in `concepts/<slug>/shots/`,
   small webp, under ~3 MB total), with commit messages ending in:
   `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
   `Claude-Session: https://claude.ai/code/session_01PrrUSitYmSR7aDjHHAhibr`
   Push to your branch (named below). Do NOT open a pull request.
5. Send the coordinator a message with `send_message` (session_id `session_01PrrUSitYmSR7aDjHHAhibr`): what you built,
   how you tested it, what you're unsure about, under ~500 words.
