export const site = {
  name: 'Crucible',
  url: 'https://crucibleinnovation.com',
  // TODO(jakob): confirm the inbox (switch to e.g. hello@ once it exists) and who answers it.
  email: 'jacob@crucibleinnovation.com',
  // The person the quote form is addressed to.
  founder: {
    name: 'Jacob Schopp',
    firstName: 'Jacob',
    role: 'Co-founder, Crucible',
    // TODO(jakob): confirm.
    email: 'jacob@crucibleinnovation.com',
  },
  /** Both co-founders (footer, structured data, page authors). */
  founders: [
    { name: 'Jacob Schopp', role: 'Co-founder, Crucible', email: 'jacob@crucibleinnovation.com' },
    { name: 'Charles Rochford', role: 'Co-founder, Crucible', email: 'charles@crucibleinnovation.com' },
  ],
  // TODO(jakob): create a Formspree form and add its ID as the FORMSPREE_ID repo variable (see README).
  formspreeId: process.env.NEXT_PUBLIC_FORMSPREE_ID ?? '',
  // The Verge waitlist's own Formspree form, kept apart from the quote form's. Until it is set, /verge sign-ups arrive as
  // emails the visitor sends.
  // TODO(jakob): when Verge needs a list, create a Formspree form for the waitlist and add its ID as the
  // FORMSPREE_WAITLIST_ID repo variable (see README).
  formspreeWaitlistId: process.env.NEXT_PUBLIC_FORMSPREE_WAITLIST_ID ?? '',
} as const;
