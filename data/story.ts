// "Why Crucible" on the home page: both co-founders in their own words, side by side on wide screens.
// Their words; keep them theirs. Charlie's is exactly as he wrote it. Facts in Jacob's were checked: eBay bought
// PayPal in 2002, Max Levchin's incubator put up Yelp's first $1M, steel is mostly iron with a little carbon.
export type FounderStory = {
  name: string;
  role: string;
  /** CRT portrait (public/team/*-crt.webp, made by scripts/crt-portraits.py): a bone phosphor screen on transparent. */
  portrait: string;
  paragraphs: string[];
  /** One sentence of a paragraph set at display size where it stands: the paragraph flows into it and continues after,
   * so it is read once, in order. `sentence` must appear exactly once in `paragraphs[paragraph]`. */
  breakOut?: { paragraph: number; sentence: string };
};

export const stories: FounderStory[] = [
  {
    name: 'Jacob Schopp',
    role: 'Co-founder, Crucible',
    portrait: '/team/jacob-crt.webp',
    paragraphs: [
      'My name is Jacob Schopp, and I am still in high school. Crucible, which I co-founded with Charlie Rochford, is the name we build our ventures under.',
      'Crucible started with a car ride, when my dad put on the audiobook of Walter Isaacson’s biography of Elon Musk. Most of what I took from it concerned Elon himself, but part of the book covers PayPal and the people who worked there before eBay bought the company in 2002. After the sale, members of that group went on to found YouTube, LinkedIn, Yelp and Palantir, while Elon used much of his share of the money to fund SpaceX and later to invest in Tesla. People call them the PayPal Mafia. It is interesting that so much came out of a single company, and I do not believe it was luck, the members being exceptional people who found each other early and continued to back one another long after PayPal itself was gone. When Jeremy Stoppelman and Russel Simmons set out to start Yelp, it was their former PayPal colleague Max Levchin who put up the first million dollars.',
      'That group came together mostly in their twenties. I want to know what happens when a group like it comes together earlier. Every high school has a handful of people who are already building things and thinking about problems far larger than the next test, yet most of them never meet, or they meet and nothing comes of it. The long-term goal of Crucible is to find those people while we are still young and to bring them together, so that between us we can create something generational.',
      'The name comes from what a crucible actually is, a vessel built to hold metal as it melts, in which separate metals can be combined into an alloy. Steel, being mostly iron with a small amount of carbon added, is far stronger than the iron it is made from. That is the idea behind the name, and it applies to the way people work with one another as much as it does to the way people work with AI. The logo is two rings, half drawn as continuous lines and half as pixels, meeting at an orange core. The human half and the machine half. I believe that people who learn to work alongside AI now, while they are young, will be able to build things that only a few years ago would have required a far larger and more experienced team.',
      'For now, Crucible has one venture, Crucible Sites, which designs and builds websites for local businesses. Charlie and I build the sites together, and our first ones are already lined up. It is small compared to what I want Crucible to become, and I know that. However it is real work, and it is where we are learning to ship.',
      'Some people hear all of this and find it unrealistic for someone my age, perhaps even egotistical. I can understand why they react that way. But if I commit myself fully to this and have even a .1% chance of building something that changes the world, would that not be worth it? I intend to find out, and maybe, years from now, the people who build it with me will have a name too.',
    ],
    breakOut: { paragraph: 2, sentence: 'I want to know what happens when a group like it comes together earlier.' },
  },
  {
    name: 'Charles Rochford',
    role: 'Co-founder, Crucible',
    portrait: '/team/charlie-crt.webp',
    paragraphs: [
      'I’m Charles Rochford, a young entrepreneur, developer, and co-founder of Crucible Innovation. I’ve always been fascinated by technology, entrepreneurship, and the potential for new ideas to change the world. My passion comes from a desire to create something meaningful, challenge conventional thinking, and contribute to a future that’s better than the world we live in today.',
      'My interest in entrepreneurship began with a curiosity about how businesses operate and how technology can be used to solve real-world problems. Since then, I’ve spent much of my time exploring new ideas, developing technical skills, and learning what it takes to turn a concept into something valuable. Through my experiences in software development, business strategy, and entrepreneurship, I’ve come to appreciate both the creativity and persistence required to build something from the ground up.',
      'As a co-founder of Crucible Innovation, I want to help create a company that stands for more than financial success. I believe that businesses have the potential to be powerful forces for positive change, and I want our work to reflect that belief. My goal is to build something that makes people’s lives better, creates new opportunities, and contributes to meaningful progress.',
      'Outside of entrepreneurship, I’m a high school student with a strong interest in mathematics, science, and technology. Studying mathematics several years ahead of my grade level has strengthened my analytical thinking and problem-solving abilities. I’m constantly looking for opportunities to learn, challenge myself, and develop skills that will help me pursue increasingly ambitious goals.',
      'Ultimately, I want to spend my life building things that matter. I don’t measure success solely by the size of a company or the amount of money it generates, but also by the positive impact it has on the people and world around it. Through Crucible Innovation, I hope to turn that philosophy into action, helping create a future defined by progress, opportunity, and lasting improvement.',
      'For me, Crucible Innovation is more than a business. It’s an opportunity to turn ambition into action and contribute to making the world a better place.',
    ],
  },
];
