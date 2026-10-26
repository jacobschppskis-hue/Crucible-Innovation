// Crucible sayings (from the brand's "Sayings" sheet). `i: true` marks the italic part.
export type Saying = {
  cat: 'Alloy' | 'Heat' | 'Test' | 'Zero';
  line: { t: string; i?: boolean }[];
  note: string;
  tone: 'dark' | 'ember' | 'bone';
};

/** The sayings gallery on the home page. Ember and bone cards are spaced out so a screen never shows more than one of each. */
export const gallery: Saying[] = [
  { cat: 'Heat', line: [{ t: 'Everything new was once ' }, { t: 'molten.', i: true }], note: 'Every casting starts as a liquid.', tone: 'dark' },
  { cat: 'Test', line: [{ t: 'The vessel does not melt.' }], note: 'A crucible has one job: stay solid while everything inside it changes.', tone: 'bone' },
  { cat: 'Test', line: [{ t: 'Hard is brittle. ' }, { t: 'Tempered is tough.', i: true }], note: 'Quenched steel shatters. Tempering trades a little hardness for toughness.', tone: 'dark' },
  { cat: 'Zero', line: [{ t: 'Think in ' }, { t: 'kelvin.', i: true }], note: 'Measure from absolute zero, not from where everyone else starts.', tone: 'dark' },
  { cat: 'Test', line: [{ t: 'Latent ' }, { t: 'heat.', i: true }], note: 'Energy that changes a state without changing the reading.', tone: 'ember' },
  { cat: 'Heat', line: [{ t: 'Nothing is created. ' }, { t: 'Everything is transformed.', i: true }], note: 'After Lavoisier’s law of conservation of mass.', tone: 'dark' },
  { cat: 'Zero', line: [{ t: 'Entropy is the ' }, { t: 'default.', i: true }], note: 'Order only lasts where someone keeps spending energy.', tone: 'dark' },
  { cat: 'Test', line: [{ t: 'Refractory.', i: true }], note: '1. Resistant to heat.\n2. Stubborn.', tone: 'bone' },
];
