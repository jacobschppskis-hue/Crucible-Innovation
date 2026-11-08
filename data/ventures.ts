export type Venture = {
  slug: string;
  name: string;
  /** One line, used on cards and in the footer. */
  blurb: string;
  /** The venture's own line, shown big on its page. No trailing period (it's a heading). */
  tagline?: string;
  status: 'live' | 'forging';
  /** Where the card links. Omit it and a page is generated at /ventures/[slug]. */
  href?: string;
  /** Longer copy for the generated /ventures/[slug] page. Jacob's words; keep them his. */
  description?: string;
  /** The venture's mark (public/ventures/<slug>.svg), if it has one. */
  mark?: string;
  /** Cast-ingot render (public/film/ingots/<slug>-*.webp): the old foundry floor; the monolith wins when both exist. */
  ingot?: string;
  /** Its metal monolith, rendered by the home page's world (public/film/monoliths/<name>-{600,1200,2400}.webp,
   *  scripts/monolith-stills.mjs): shown on /ventures and its own page. */
  monolith?: string;
};

// Adding a venture = adding one entry here. `forging` ventures still get a page (a teaser) but are shown glowing in
// their mould: unfinished. Never invent dates, users or numbers for them.
// Verge and Trellis copy is Jacob's (crucible-verge-trellis.html, 2026-11-04). "Coming soon" is shown as their status.
export const ventures = [
  {
    slug: 'sites',
    name: 'Crucible Sites',
    blurb: 'Websites for local businesses, built in days.',
    status: 'live',
    href: '/sites',
    ingot: 'sites',
    monolith: 'crucible-sites',
  },
  {
    slug: 'verge',
    name: 'Verge',
    blurb: 'An AI coach for endurance athletes.',
    tagline: 'Find your verge',
    status: 'forging',
    description:
      'Verge is an AI coach for endurance athletes, built on the training data they already have. It tracks training load and recovery, using sleep, heart rate variability and resting heart rate to score how ready the body is each morning, that score deciding how hard the day’s session should be. A run-down day gets a lighter workout. The plan adjusts day by day and every session comes back with written feedback. The algorithms underneath took a long time to get right. It is made for runners, cyclists and triathletes.',
    mark: '/ventures/verge.svg',
    ingot: 'verge',
    monolith: 'verge',
  },
  {
    slug: 'trellis',
    name: 'Trellis',
    blurb: 'An AI day planner that works with what you know.',
    tagline: 'A day that actually fits',
    status: 'forging',
    description:
      'Trellis is an AI-powered day planner built around how much you know about when something happens. Tell it “at 2pm,” “sometime this afternoon” or “by Friday,” and it works with exactly that much, placing everything into a plan that fits the hours you really have. The AI reads what you write, and a solver that follows fixed rules does the scheduling, so the same input always gives the same plan. A day that falls apart leaves no pile of overdue tasks behind. Unfinished work goes back where it came from, ready for the next try.',
    mark: '/ventures/trellis.svg',
    ingot: 'trellis',
    monolith: 'trellis',
  },
] as const satisfies readonly Venture[];

export const ventureHref = (v: Venture) => v.href ?? `/ventures/${v.slug}`;
