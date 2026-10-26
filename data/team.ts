// The people a client actually works with ("Meet the builders" on /sites).
// Only write things that are true. With one entry the section reads "Hi, I'm …";
// with two or more it becomes "Meet the builders."
export type Builder = {
  name: string;
  role: string;
  email?: string;
  /** Portrait image (public/team/*.webp, ~5:6, dark ink on transparent). Without one, a Split Ring placeholder shows. */
  portrait?: string;
  bio: string[];
  signoff?: string;
};

export const builders: Builder[] = [
  {
    name: 'Jacob Schopp',
    role: 'Founder, Crucible · Co-founder, Crucible Sites',
    email: 'jacob@crucibleinnovation.com',
    portrait: '/team/jacob.webp',
    bio: [
      'I am still in high school, and Crucible is the name I build my ventures under. Crucible Sites is the first of them, and I build the sites with Charlie. Our first ones are already lined up.',
      'When you work with us, you talk directly to the people building your site, from the first call until the day it goes live. Tell me about your business and I will get back to you within 24 hours.',
    ],
    signoff: 'Talk soon, Jacob.',
  },
  {
    name: 'Charlie Rochford',
    role: 'Co-founder, Crucible Sites',
    email: 'charles@crucibleinnovation.com',
    portrait: '/team/charlie.webp',
    // From Charlie's own answers.
    bio: [
      'I do the same work Jacob does, from designing and building the sites to talking with the businesses we build them for.',
      'I am pretty skilled at math and have a small programming background in Python.',
    ],
    signoff: 'Happy to help, Charlie.',
  },
];
