export const site = {
  name: 'Crucible',
  url: 'https://crucibleinnovation.com',
  // TODO(jakob): confirm the inbox (switch to e.g. hello@ once it exists) and who answers it.
  email: 'jacob@crucibleinnovation.com',
  founder: {
    name: 'Jacob Schopp',
    firstName: 'Jacob',
    role: 'Founder, Crucible Sites',
    // TODO(jakob): add a photo (e.g. '/jacob.webp', 4:5, ~1000px tall). Until then a Split Ring placeholder shows.
    photo: undefined as string | undefined,
    // TODO(jakob): confirm.
    email: 'jacob@crucibleinnovation.com',
  },
  // TODO(jakob): create a Formspree form and set NEXT_PUBLIC_FORMSPREE_ID in Vercel.
  formspreeId: process.env.NEXT_PUBLIC_FORMSPREE_ID ?? '',
} as const;
