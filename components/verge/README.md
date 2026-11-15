# /verge

Verge's own page before launch: its landing page in its own type and colours, with a waitlist in place of sign-up. `app/verge/page.tsx` is the route. Everything it needs is in this folder and in `public/verge/`.

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
| `verge-extra.css` | Hand-written additions, scoped the same way. |
| `fonts/` | Schibsted Grotesk, Latin, weights 400 to 900, SIL Open Font License (`OFL.txt`). |

## Styling

The classes are Verge's Tailwind 3 classes on Verge's own scale: `mt-24` is 24 px, `text-body` is Verge's body size. Only classes that already appear in `verge.css` do anything. The site's own Tailwind is told not to read this folder (`@source not` in `app/globals.css`), so it never adds its own meaning for the same names. Everything in `verge.css` sits under `.verge-page`, the wrapper in `app/verge/page.tsx`, so none of it reaches the rest of the site.

To style something new without the Verge repo, write plain CSS in `verge-extra.css` under `.verge-page`. The colours are custom properties: `--ground`, `--ink`, `--ink-muted`, `--hairline`, `--accent` (set on the wrapper from Verge's palette).

To regenerate `verge.css` after adding Verge classes, from a checkout of the Verge repo:

```bash
./node_modules/.bin/tailwindcss -c tailwind.config.ts -i app/globals.css --content "<this repo>/components/verge/**/*.tsx" -o /tmp/verge-raw.css
```

Then scope it to `.verge-page` (every selector prefixed, `:root`, `html` and `body` become `.verge-page`, `@font-face` dropped) and replace `verge.css`.

## The waitlist

It posts the way the /sites quote form does: to Formspree at `FORMSPREE_ID`, with `_subject` "Verge waitlist" and a hidden `form` field set to `verge-waitlist`, so its entries can be told apart from quote requests. Fields: `email` (required), `sport`, `wears`, `beta` (yes or no), plus `ref` and `page`. The honeypot is `_gotcha`.

Without `FORMSPREE_ID` there is no list. The form writes the request as an email to `site.email` for the visitor to send (phones open the mail app at once), and without JavaScript it opens a mail app.

## Rules for this page

The site's rules apply (`CLAUDE.md`). On top of them, until launch: no prices, no dates, no user counts or testimonials, and no claim that Verge works with a particular watch, ring or service. The wearable names in the form are a question, not a claim.
