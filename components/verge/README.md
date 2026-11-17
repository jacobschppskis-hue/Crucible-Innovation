# /verge

Verge's own page before launch: Verge's landing page, in Verge's own words, with a waitlist where sign-up will be. It previews Verge, so it is Verge and nothing else: Verge's type, palette, accent, focus ring and skip link, and none of Crucible's.

It has its own root layout, `app/(verge)/layout.tsx` (the route is `app/(verge)/verge/page.tsx`). The Crucible pages share theirs in `app/(site)`, so Crucible's CSS, Archivo, the liquid and floating text, Lenis, the reveals and the route transition never load on /verge, and going between /verge and the rest of the site is a full page load. The only font /verge loads is Schibsted Grotesk. Everything /verge needs is in this folder and in `public/verge/` (`icon.svg`, `apple-icon.png`, and the share image `og.jpg`).

## Where it came from

The markup is Verge's landing page (the Verge repo's `components/landing/Landing.tsx`) and its Today screen (`/dev/preview/today?palette=spruce`), converted to JSX so they look exactly like Verge. The wording is Verge's. What changed for the page before launch:

- The waitlist form (`WaitlistForm.tsx`) is where the opening's Create account button was, beside See how it decides.
- Sign in and Create account (header, closing section, footer) go to the waitlist form.
- The closing section has one more line: "The more people sign up, the sooner it opens, because every email shows there are athletes waiting to use it."
- The Today screen sits in a phone after the opening, with "Early design. The app will change before launch." under it (`VergeToday.tsx`). Nothing in it does anything: its buttons are text, and its links go to the waitlist form. "From Garmin" is left out of it.
- Not here, because the page can't make them true yet: the "What it costs" section (no prices before launch), and the links to the AI transparency statement and the legal pages (this site doesn't have them). The footer says who makes Verge where the legal pages were.

| File | What it is |
|---|---|
| `VergeLanding.tsx` | The page. Edit it like any component. |
| `WaitlistForm.tsx` | The waitlist. |
| `VergeToday.tsx` | The Today screen in a phone frame (the frame is in `verge-extra.css`). |
| `VergeFooter.tsx` | The footer. |
| `verge.css` | Verge's styles, generated. Do not edit by hand. |
| `verge-extra.css` | Hand-written additions, scoped the same way: the phone frame, square focus rings, and a guard for translate. |
| `fonts/` | Schibsted Grotesk, Latin, weights 400 to 900, SIL Open Font License (`OFL.txt`). |

## Styling

The classes are Verge's Tailwind 3 classes on Verge's own scale: `mt-24` is 24 px, `text-body` is Verge's body size. Only classes that already appear in `verge.css` do anything, so regenerate it after adding one. The site's own Tailwind is told not to read this folder (`@source not` in `app/globals.css`), so the two never give one class name two meanings. `verge.css` is scoped to `.verge-page`, the class on /verge's `<html>`: Verge's `:root` and `html` rules land on that `<html>`, its `body` rules on the body, everything else under it, the same elements as in the Verge app.

The Today screen uses only the classes a 390 px phone uses (no `sm:`, `md:`, `lg:` or `xl:`), so it stays a phone on a wide screen. Verge's `text-decision` grows with the window, so the screen's headline is written at its phone size, `text-[34px] leading-[1.04]`.

To style something new without the Verge repo, write plain CSS in `verge-extra.css` under `.verge-page`. The colours are custom properties: `--ground`, `--ink`, `--ink-muted`, `--hairline`, `--accent` (from Verge's palette, set on `<html>` in the layout; `.surface-reading` switches to the light reading ground, `.surface-field` back to the dark one).

To regenerate `verge.css` after adding Verge classes, from a checkout of the Verge repo:

```bash
./node_modules/.bin/tailwindcss -c tailwind.config.ts -i app/globals.css --content "<this repo>/components/verge/**/*.tsx,<this repo>/app/\(verge\)/**/*.tsx" -o /tmp/verge-raw.css
```

Then scope it: `:root`, `html` and `:host` become `.verge-page`; `body` becomes `.verge-page body`; `*` and selectors that start with `::` apply to both `.verge-page` and what is under it; every other selector is prefixed with `.verge-page `; `@font-face` rules are dropped. Replace `verge.css` with the result.

## The waitlist

For now each sign-up is an email the visitor sends. The form writes it (subject "Verge waitlist", their answers in the body) to `site.email` and offers their mail app, Gmail, Outlook or Copy message, like the /sites quote form; phones open the mail app straight away. "Change my answers" goes back to the form with the answers kept. Without JavaScript the form opens a mail app.

When Verge needs a real list, create a Formspree form for it and add its ID as the repo variable `FORMSPREE_WAITLIST_ID` (`NEXT_PUBLIC_FORMSPREE_WAITLIST_ID` in the deploy and CI workflows, `site.formspreeWaitlistId` in `data/site.ts`). The form then posts there in place. It never posts to the quote form's `FORMSPREE_ID`. Fields: `email` (required), `sport`, `wears`, `beta` (yes or no), plus `ref`, `page`, `_subject` "Verge waitlist" and `form` "verge-waitlist". The honeypot is `_gotcha`. If Formspree turns the email down (a 422), the form says "That email doesn’t look quite right" under the field.

## Rules for this page

/verge looks like Verge, not like Crucible. The site's look rules (Ember as the only accent, Archivo, the Ember focus ring, the liquid and the other effects) do not apply here: use Verge's palette, type and components, and make it look the way the Verge app does. Jacob's call (Nov 15): don't mix the two.

The site's content rules do apply (`CLAUDE.md`): no "LLC", no "incorporated", no street address, no payment details, no em dashes. On top of them, until launch: no prices, no dates, no user counts or testimonials, and no claim that Verge works with a particular watch, ring or service. The wearable names in the form are a question, not a claim, and "such as Strava" names a service whose data never reaches the AI.
