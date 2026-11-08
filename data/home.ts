// Home page copy outside the founders' stories. Seeded by `world`; owned by `mark` (hero, "stronger together") and the
// section owners for their lines. Every fact comes from Jacob's text (data/story.ts); no invented claims.
export const hero = {
  /** The headline, set as two lines. "alloyed" is the one word cast white-hot (the only gradient-like exception). */
  lines: ['Intelligence,', 'alloyed'],
  lede: 'Human judgment and machine range, fused into one material. Crucible is a studio that builds and ships ventures.',
  primary: { href: '/sites', label: 'See Crucible Sites' },
  secondary: { href: '#ventures', label: 'Our ventures' },
};

/** The "stronger together" moment (replaces "Not the person / Not the model / Neither, alone"). Draft lines: `mark` owns. */
export const together = {
  // placeholder lines until `mark` writes them
  lines: ['A person, a machine', 'Stronger together'],
};

export const storyIntro = {
  heading: 'Why Crucible',
  lede: 'Jacob Schopp and Charles Rochford, co-founders, each in their own words.',
};

/** PayPal, step by step: every caption is a fact from Jacob's paragraph 2 (data/story.ts). `paypal` owns. */
export const paypal = {
  heading: 'So much came out of a single company',
  steps: [
    'eBay bought PayPal in 2002.',
    'Its people went on to found YouTube, LinkedIn, Yelp and Palantir.',
    'Elon used much of his share to fund SpaceX, and later to invest in Tesla.',
    'So much came out of a single company.',
  ],
  companies: ['YouTube', 'LinkedIn', 'Yelp', 'Palantir', 'SpaceX', 'Tesla'],
};

export const venturesIntro = {
  heading: 'Everything new was once molten',
};

export const thesis = {
  lines: ['Nothing new happens at 293 K', 'An alloy is stronger than its metals'],
  notes: ['293 K is room temperature.', 'Steel is harder than iron. Bronze is harder than copper.'],
};
