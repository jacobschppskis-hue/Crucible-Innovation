# Overnight build PRD

What it is: crucibleinnovation.com. "/" is Crucible, Jacob Schopp's studio. "/sites" is Crucible Sites, which builds websites for local businesses. The site is the sales pitch: a website company's own website. It should make people stop and think "this is incredible, this must have taken forever to build." Big, bold, cinematic, but tasteful. Bold in a good way, never annoying or gimmicky.

Priorities, in order:
1. The very first moments of "/": the opening animation and the first scroll. This is the first impression and matters most.
2. The first scroll of "/sites": show off the kind of interfaces we can build.
3. Everything else gets the same level of craft.

Research first: look at award-winning sites (Awwwards Site of the Year and Site of the Day, FWA, CSS Design Awards, Godly, studios like Lusion, Active Theory, Locomotive, Immersive Garden, plus Apple product pages, Linear, Stripe and Vercel launch pages). Take the best ideas, techniques and feel, not copies. Total creative freedom on layout, motion and new sections. Record what you took from where in PROGRESS.md.

Two tiers, chosen at runtime:
- Rich tier, only when the connection is fast and the device capable (decide how to detect that, and handle Safari, which has no Network Information API): WebGL/shaders/3D are allowed, e.g. molten metal, heat shimmer, a 3D or particle Split Ring, whatever is most impressive. Load it after first paint so it never delays the page.
- Light tier, the default for slow connections, weak phones, Save-Data and reduced-data: still beautiful, with great CSS/canvas animation, fast to load.
- prefers-reduced-motion: calm, finished states. No JS: everything still readable.

Non-negotiables:
- Follow CLAUDE.md: brand tokens, the Split Ring logo and Spark wordmark, Ember used sparingly. Never write "LLC", a street address or payment details. No fake testimonials, clients or stats; concept work stays labeled "Concept".
- Keep all real content and data: Jacob's story (data/story.ts), the sayings placed individually (never dumped in one block), the team section with their ASCII-art portraits, pricing, FAQ, and the quote form's email flow. You can restyle and restructure how it's presented, but keep the words.
- Light tier on mobile: Lighthouse accessibility, best practices and SEO ≥ 95, performance ≥ 90. Smooth 60fps scrolling. No horizontal scroll at 360px. Static export on GitHub Pages: no server.
- `npm test` and CI stay green. Add tests for anything new that could break.

How to work:
- Read PROGRESS.md first, every session.
- Get one excellent slice done first (the "/" opening), then go by value.
- Check like a user: build, run, record it with Playwright (Chromium is preinstalled; capture video or frame sequences of the animations, not just stills), look at it critically like a design-award judge, fix it, repeat. Check phone and desktop widths.
- Commit and push after every milestone. Keep a draft PR open from overnight/award-build to main, and update its description with what changed and recordings or GIFs of the key animations, so I can see it moving before I merge.

Done means:
- The "/" opening and first scroll and the "/sites" first scroll are at award-site level, and the rest of both pages matches.
- The rich and light tiers both work, and the fallbacks are verified.
- Tests and CI are green, the performance targets are met, and there's no regression in content or the quote form.
- overnight/MORNING.md exists, covering: what was built, how to see it (the PR, recordings, how to preview locally), decisions to review, known issues, and the one-step merge to go live.
- The draft PR is up to date and the scheduled task is disabled.
- Finally, create overnight/DONE.

## Standing rules for every session (from the original request)

- Jacob is asleep: never stop to ask anything. When a choice is unclear, make the best call, log it under "Decisions to review" in overnight/PROGRESS.md, and keep going.
- Work only on branch `overnight/award-build`. Pushing to it is allowed. Never push to main, never merge, never touch the live site.
