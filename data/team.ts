// The people a client actually works with ("Meet the builders" on /sites).
// Only write things that are true. With one entry the section reads "Hi, I'm …";
// with two or more it becomes "Meet the builders."
export type Builder = {
  name: string;
  role: string;
  /** Portrait, e.g. '/team/jacob.webp' (4:5, ~1000px tall). Until then a Split Ring placeholder shows. */
  photo?: string;
  bio: string[];
  signoff?: string;
};

export const builders: Builder[] = [
  {
    name: 'Jacob Schopp',
    role: 'Founder, Crucible Sites',
    // TODO(jakob): add a photo.
    bio: [
      'I am still in high school, and Crucible is the name I build my ventures under. Crucible Sites is the first of them, and I build the sites with Charlie. Our first ones are already lined up.',
      'When you work with us, you talk directly to the people building your site, from the first call until the day it goes live. Tell me about your business and I will get back to you within 24 hours.',
    ],
    signoff: 'Talk soon, Jacob.',
  },
  // TODO(jakob): add Charlie once he's answered the questions, for example:
  // { name: 'Charlie …', role: '…, Crucible Sites', bio: ['…'], signoff: '…' },
];
