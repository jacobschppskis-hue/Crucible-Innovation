// Concept sites only until real clients exist. Never relabel these as client work.
// TODO(jakob): swap for real client work (and real screenshots) as it ships.
export type Work = {
  slug: string;
  name: string;
  type: string;
  blurb: string;
  image: string;
  alt: string;
  label: 'Concept' | 'Client';
};

export const work: Work[] = [
  {
    slug: 'cafe',
    name: 'Halcyon Coffee',
    type: 'Café',
    blurb: 'Warm, editorial, menu up front.',
    image: '/showcase/cafe.webp',
    alt: 'Concept homepage for a fictional café: cream background, serif headline “Slow mornings, good coffee.”, and a latte illustration.',
    label: 'Concept',
  },
  {
    slug: 'barber',
    name: 'Sharp & Co.',
    type: 'Barbershop',
    blurb: 'Bold type, prices visible, booking in one tap.',
    image: '/showcase/barber.webp',
    alt: 'Concept homepage for a fictional barbershop: black and brass, condensed headline, and a service price list.',
    label: 'Concept',
  },
  {
    slug: 'landscaper',
    name: 'Fieldstone Landscaping',
    type: 'Landscaper',
    blurb: 'Calm greens, services clear, estimate on every screen.',
    image: '/showcase/landscaper.webp',
    alt: 'Concept homepage for a fictional landscaping company: deep green hills illustration and a free estimate button.',
    label: 'Concept',
  },
];

/**
 * Client sites, shown first on /work (a short description, the live site embedded, a link) and first in the /sites
 * work grid. Empty until the first ones launch: both pages then show the concepts, and /work says client sites are on
 * their way. Only add a site once it is live and the client is happy for it to be shown.
 */
export type ClientSite = {
  slug: string;
  name: string;
  /** e.g. 'Café'. */
  type: string;
  /** One or two sentences: what the business is and what the site does for it. */
  description: string;
  /** The live site. */
  url: string;
  /**
   * Embed the live site on /work. Some sites refuse to be framed (X-Frame-Options / CSP frame-ancestors); set false for
   * those and the screenshot is shown instead.
   */
  embed: boolean;
  /**
   * Screenshot, made with `node scripts/shoot-client.mjs <slug> <url>` → '/work/<slug>.webp'. Shown on /sites, on /work
   * while the embed loads, and instead of it when `embed` is false.
   */
  image?: string;
};

// TODO(jakob): the three client sites. Fill one in and uncomment it once that site is live (and its client says yes):
// 1. Made, not up yet.
// 2. Being made (waiting on photos).
// 3. Not made yet.
export const clientSites: ClientSite[] = [
  // {
  //   slug: 'example',
  //   name: 'Example Bakery',
  //   type: 'Bakery',
  //   description: 'A neighbourhood bakery. The site puts the day’s bakes and the opening hours first.',
  //   url: 'https://examplebakery.com',
  //   embed: true,
  //   image: '/work/example.webp',
  // },
];
