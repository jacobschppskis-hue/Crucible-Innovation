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
 * Published client sites, shown first on /work with a short description, a live embed and a link.
 * Empty until the first ones launch: /work then shows the concepts and Crucible's own work instead.
 * Only add a site once it is live and the client is happy for it to be shown.
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
   * Embed the live site in a frame. Some sites refuse to be framed (X-Frame-Options / CSP frame-ancestors);
   * set false for those and add a screenshot as `image` instead.
   */
  embed: boolean;
  /** Optional screenshot (public/work/<slug>.webp), used when the embed is off and as the poster before it loads. */
  image?: string;
};

// TODO(jakob): add the three sites here as they go live, e.g.
// { slug: 'example', name: 'Example Bakery', type: 'Bakery', description: '…', url: 'https://example.com', embed: true },
export const clientSites: ClientSite[] = [];
