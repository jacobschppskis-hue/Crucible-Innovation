# /verge

Verge's own page before launch: its landing page with a waitlist in place of sign-up. It previews Verge, so it is Verge and nothing else: Verge's type, palette, accent, focus ring and skip link, and none of Crucible's.

It has its own root layout, `app/(verge)/layout.tsx` (the route is `app/(verge)/verge/page.tsx`). The Crucible pages share theirs in `app/(site)`, so Crucible's CSS, Archivo, the liquid, Lenis, the reveals and the route transition never load on /verge, and going between /verge and the rest of the site is a full page load. Everything /verge needs is in this folder and in `public/verge/` (the phone screens, `icon.svg`, `apple-icon.png`, and the share image `og.jpg`).

## Where it came from

The markup is Verge's landing page in preview mode (the Verge repo's `components/landing/Landing.tsx`, rendered at `/dev/reserve`), converted to JSX so it looks exactly like Verge. After the conversion it was edited for this site:

- No prices: the "What it costs" section is gone.
- No device or service names: the Activities and Progress screens are left out (they say "From Garmin"), and "such as Strava" is gone from the list of what never reaches the AI.
- One waitlist form (`WaitlistForm.tsx`) in the opening, and a "Get early access" link back to it at the end.
- The header links to `/ventures/verge`, and the footer (`VergeFooter.tsx`) says who makes Verge and what the email is used for.

| File | What it is |
|---|---|
| `VergeLanding.tsx` | The page. Edit it like any component. |
| `WaitlistForm.tsx` | The waitlist. |
| `VergeScreens.tsx` | The row of phone screens, from `public/verge/screens/` (440 and 880 wide). |
| `VergeFooter.tsx` | The footer. |
| `verge.css` | Verge's styles, generated. Do not edit by hand. |
| `verge-extra.css` | Hand-written additions, scoped the same way (empty for now). |
| `fonts/` | Schibsted Grotesk, Latin, weights 400 to 900, SIL Open Font License (`OFL.txt`). |

## Styling

The classes are Verge's Tailwind 3 classes on Verge's own scale: `mt-24` is 24 px, `text-body` is Verge's body size. Only classes that already appear in `verge.css` do anything. The site's own Tailwind is told not to read this folder (`@source not` in `app/globals.css`), so the two never give one class name two meanings. `verge.css` is scoped to `.verge-page`, the class on /verge's `<html>`: Verge's `:root` and `html` rules land on that `<html>`, its `body` rules on the body, everything else under it, the same elements as in the Verge app.

To style something new without the Verge repo, write plain CSS in `verge-extra.css` under `.verge-page`. The colours are custom properties: `--ground`, `--ink`, `--ink-muted`, `--hairline`, `--accent` (from Verge's palette, set on `<html>` in the layout; `.surface-reading` switches to the light reading ground).

To regenerate `verge.css` after adding Verge classes, from a checkout of the Verge repo:

```bash
./node_modules/.bin/tailwindcss -c tailwind.config.ts -i app/globals.css --content "<this repo>/components/verge/**/*.tsx,<this repo>/app/\(verge\)/**/*.tsx" -o /tmp/verge-raw.css
```

Then scope it: `:root`, `html` and `:host` become `.verge-page`; `body` becomes `.verge-page body`; `*` and selectors that start with `::` apply to both `.verge-page` and what is under it; every other selector is prefixed with `.verge-page `; `@font-face` rules are dropped. Replace `verge.css` with the result.

## The waitlist

It posts the way the /sites quote form does: to Formspree at `FORMSPREE_ID`, with `_subject` "Verge waitlist" and a hidden `form` field set to `verge-waitlist`, so its entries can be told apart from quote requests. Fields: `email` (required), `sport`, `wears`, `beta` (yes or no), plus `ref` and `page`. The honeypot is `_gotcha`.

Without `FORMSPREE_ID` there is no list. The form writes the request as an email to `site.email` for the visitor to send (phones open the mail app at once), and without JavaScript it opens a mail app.

## Rules for this page

/verge looks like Verge, not like Crucible. The site's look rules (Ember as the only accent, Archivo, the Ember focus ring, the liquid and the other effects) do not apply here: use Verge's palette, type and components, and make it look the way the Verge app does. Jacob's call (Nov 15): don't mix the two.

The site's content rules do apply (`CLAUDE.md`): no "LLC", no "incorporated", no street address, no payment details, no em dashes. On top of them, until launch: no prices, no dates, no user counts or testimonials, and no claim that Verge works with a particular watch, ring or service. The wearable names in the form are a question, not a claim.
