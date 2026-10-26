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
    // TODO(jakob): add your real "why" here (a sentence or two), and a photo.
    bio: [
      'When you work with Crucible Sites, you talk to the people actually building your site, from the first call to launch day. No account managers, no handoffs.',
      'Tell me about your business and I’ll get back to you within 24 hours.',
    ],
    signoff: 'Talk soon, Jacob.',
  },
  // TODO(jakob): add Charlie once he's answered the questions, for example:
  // { name: 'Charlie …', role: '…, Crucible Sites', bio: ['…'], signoff: '…' },
];
