// Home page copy outside the founders' stories. Seeded by `world`; owned by `mark` (hero, "stronger together") and the
// section owners for their lines. Every fact comes from Jacob's text (data/story.ts); no invented claims.
export const hero = {
  /** The headline, set as two lines. "alloyed" is the one word cast white-hot (the only gradient-like exception). */
  lines: ['Intelligence,', 'alloyed'],
  lede: 'Human judgment and machine range, fused into one material. Crucible is a studio that builds and ships ventures.',
  primary: { href: '/sites', label: 'See Crucible Sites' },
  secondary: { href: '#ventures', label: 'Our ventures' },
};

/** The "stronger together" moment (`mark` owns): a confluence on the sea, two molten rivers joining into one that runs
 * hotter (lib/world/together.ts). One line, when they meet. Display line: no period. */
export const together = {
  lines: ['Stronger together'],
};

/** A sentence of a founder's account set larger WHERE IT STANDS (never repeated; the words in data/story.ts are
 * untouched). `lead`: the opening-paragraph size (a long sentence that opens its paragraph). `title`: display type,
 * for a short sentence. Jacob's break-out (data/story.ts `breakOut`) is the one sentence at full display size. */
export type StoryLift = { paragraph: number; sentence: string; size: 'lead' | 'title' };

export const storyIntro = {
  heading: 'Why Crucible',
  lede: 'The two co-founders, each in their own words.',
  /** By founder, in the order of data/story.ts `stories`. A sentence that is not found in its paragraph is ignored. */
  lifts: [
    [
      { paragraph: 1, sentence: 'People call them the PayPal Mafia.', size: 'title' },
      {
        paragraph: 3,
        sentence: 'The name comes from what a crucible actually is, a vessel built to hold metal as it melts, in which separate metals can be combined into an alloy.',
        size: 'lead',
      },
      { paragraph: 5, sentence: 'I intend to find out, and maybe, years from now, the people who build it with me will have a name too.', size: 'title' },
    ],
    [{ paragraph: 4, sentence: 'Ultimately, I want to spend my life building things that matter.', size: 'title' }],
  ] as StoryLift[][],
};

/** PayPal, step by step: every caption is a fact from Jacob's paragraph 2 (data/story.ts), shortened. `paypal` owns.
 * The captions show one at a time as the scene plays (lib/world/paypal.ts `CAPTION_AT`); `heading` is the 4th step,
 * set at display size. Company order = the scene's landing order. */
export const paypal = {
  heading: 'So much came out of a single company',
  steps: [
    'In 2002, eBay bought PayPal.',
    'After the sale, its people went on to found YouTube, LinkedIn, Yelp and Palantir.',
    'Elon used much of his share to fund SpaceX, and later to invest in Tesla.',
    null, // the heading
    'Not by luck. They found each other early, and kept backing one another long after PayPal itself was gone.',
  ] as (string | null)[],
  companies: ['YouTube', 'LinkedIn', 'Yelp', 'Palantir', 'SpaceX', 'Tesla'],
};

export const venturesIntro = {
  heading: 'Everything new was once molten',
};

export const thesis = {
  lines: ['Nothing new happens at 293 K', 'An alloy is stronger than its metals'],
  notes: ['293 K is room temperature.', 'Steel is harder than iron. Bronze is harder than copper.'],
};
