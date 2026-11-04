---
name: unslop
description: Design rules that keep crucibleinnovation.com from reading as AI-made ("vibe-coded"). Load before designing, restyling or reviewing any page, section, component, copy or image on this site, and run its checklist before calling visual work done.
---

# Unslop

The site must read as if a professional design team made it. AI can build it (pear.no was built in Claude Code), but only if one art direction is enforced everywhere and the usual tells are not scattered around as defaults.

## The tells are a budget, not a ban

Jacob's rule (2026-11-04): avoid these *excessively* and never stack them. One used with intent, in one role, is fine. Several on one screen, or any used as decoration, is slop.

**Near-absolute: don't use these.** None of the award references do.
- Instrument Serif, or any serif italic used as an "accent word" at the end of a headline.
- Cards inside cards (a bordered, rounded box containing more bordered, rounded boxes).
- Decorative gradient backgrounds. A glow is allowed only where hot metal is in the picture.
- ASCII images. Dithering is only acceptable as a site-wide art direction, which this site does not have.
- Code breadcrumbs (`~/crucible/sites $`, `// section`, `<Ventures />` as decoration).
- Verbose, redundant copy. Say it once. If two sentences say the same thing, cut one.
- Over-detailed diagrams. One idea per visual.

**Depends on execution: allowed, each with exactly one job.**

| Tell | Allowed when |
|---|---|
| Mono font | It sets real data: the kelvin readout, a timestamp, a URL in a browser frame. Never labels or body text. |
| All caps | Short UI labels with tracking 0 to 0.05em. Never small caps with wide tracking (0.12em+). |
| Negative tracking | Display sizes only (≥ 48px), and only as much as the face needs. Body and UI stay at 0. |
| Eyebrows (small label above a heading) | It adds information the heading doesn't (a date, a status). Never a section name that repeats the nav. |
| Pills / tags | It's a real control (a choice in the form). Never decoration ("Concept" can be plain text). |
| Section numbering | It's real navigation or a real sequence the visitor scrubs (the 7 days of the process). Never "01 · Every screen". |
| Shades and opacities | Only the tokens in `app/globals.css`. No ad-hoc `rgba()` or `/40` opacity utilities. |
| Dividers | Rarely. Separate with space, scale or a surface flip. |
| Dense, detailed UI | It's a real product UI being shown (the live concept sites). |
| Periods | In body sentences. Never at the end of a heading, button or title. |

**The stacking test.** Look at any one screen. If it has two or more of the conditional tells, remove one.

## The house concept: "One pour"

- **The whole site is one continuous casting.** Each section is something the metal does: it pours, fills a mould, sets, or cools. Hand off between sections with motion or a surface flip, not a hard edge.
- **Colour means temperature.**
  - Ember (`--ember`) is hot: active, interactive, live, hovered, focused, in progress.
  - Bone is cooled: settled, read, done.
  - Nothing is Ember just to be pretty. About three Ember elements per screen at most.
- **Light comes from the metal.** Glow appears only where hot metal is visible.
- **One art direction for all imagery:** a foundry at night, shot on a macro lens.
  - A warm key light from below and a faint cool fill from above.
  - Sand-cast metal with real surface variation.
  - Blender sources live in `film/`. Never mix in stock photos, clip art or other styles.
- **No real photos of people.** The founders appear as engraved line portraits.

## Type

- One family does the work, and contrast comes from size, weight and width rather than from a second decorative face.
- The scale is poster-like: display type is very large, labels are small, and there is little in between.
- The wordmark (`components/Wordmark.tsx`) is the logo and keeps its own drawing.

## Copy

- Short. Lean toward captions.
- No periods in headings, and no section numbering.
- The founders' accounts in `data/story.ts` are their words: never edit them.
- Brand sayings are placed once each, where they fit.
- Never write "LLC", "incorporated", a street address or payment details.
- No invented testimonials, clients, logos or stats. Concept work is labelled Concept.

## Motion

- Something in view should respond to scroll at every position (no dead zones). Long text can scroll normally, but give it a pinned visual partner.
- Reveal display lines only (masked line or word reveals, `cubic-bezier(.16,1,.3,1)`). Body text just fades.
- Every effect has a light-tier version, respects `prefers-reduced-motion`, and leaves content readable with JS off.

## Review checklist (run before calling any visual work done)

1. Build, then record the scene on phone (390px) and desktop (1440px). Look at the frames, not the code.
2. Run the stacking test on every screen.
3. Check the near-absolute list. None of those items should be present.
4. Is every hot (Ember) element active, interactive or live?
5. Does any copy repeat something already said on the page?
6. Does every image look like it came from the same foundry at night?
7. Run `npm run unslop` (Playwright: tells per section, headings ending in a period, wide-tracked caps, mono outside data). Then run `npm test` and check Lighthouse.
8. Ask: would a design-award judge think a team made this? If not, say what gives it away and fix that first.
