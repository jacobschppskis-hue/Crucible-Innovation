// Concept sites: fictional businesses. Never relabel these as client work (real client sites are `clientSites`, below).
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
 * Client sites, shown first on /work and first in the /sites work grid. Only add a site once it is live and the client
 * is happy for it to be shown. Every word here comes from the client's own live site: no invented numbers, quotes,
 * timelines or prices.
 */
export type ClientSite = {
  slug: string;
  name: string;
  /** e.g. 'Café'. */
  type: string;
  /** One short line for the /sites grid: what the business is. */
  blurb: string;
  /** One or two sentences for /work: what the business is and what the site does for it. */
  description: string;
  /** The live site. */
  url: string;
  /**
   * Embed the live site on /work. Some sites refuse to be framed (X-Frame-Options / CSP frame-ancestors); set false for
   * those and its screenshots are shown instead.
   */
  embed: boolean;
  /**
   * The top of the page on a desktop, made with `node scripts/shoot-client.mjs <slug> <url>` → '/work/<slug>.webp'
   * (with '-960' and '-640', and the phone's '/work/<slug>-phone.webp' with '-390'). Shown on /sites, on /work while
   * the embed loads, and instead of it when `embed` is false.
   */
  image?: string;
  /**
   * For a site that can't be embedded: the film on /work. Moments down the page in scroll order, the first being the
   * top (`image`); the visitor's scroll plays them in a browser and a phone (components/Work.tsx, ClientFilm). Each
   * needs both shots from the same shoot-client run: `image` on a desktop and '<image>-phone.webp' on a phone.
   */
  moments?: Moment[];
};

export type Moment = {
  /** '/work/<slug>-<key>.webp' (for the first moment, the site's `image`). */
  image: string;
  /** One line shown while this moment is on screen: what the visitor is looking at. */
  caption: string;
  /** What the shot shows, for people who can't see it. */
  alt: string;
};

// TODO(jakob): one client site is live (Norma). Add each of the others here once it is live too (and its client says yes).
export const clientSites: ClientSite[] = [
  {
    // node scripts/shoot-client.mjs norma https://normacustomcarpentry.com 'square=#constTrack@0.5' 'door=#door@0.52' 'sky=#door@0.7' 'specialties=#shelfTrack@0.5'
    slug: 'norma',
    name: 'Norma Custom Carpentry',
    type: 'Custom carpentry',
    blurb: 'Hidden doors, cedar saunas and cabinetry, from a shop in Arvada, Colorado.',
    description:
      'A carpentry shop in Arvada, Colorado: hidden doors, cedar saunas, cabinetry and built-ins. It is named after Norma, the constellation shaped like a carpenter’s square, so its site is set in that patch of sky.',
    url: 'https://normacustomcarpentry.com',
    embed: false, // it sends X-Frame-Options: SAMEORIGIN
    image: '/work/norma.webp',
    moments: [
      {
        image: '/work/norma.webp',
        caption: 'The opening: the shop’s name among the stars around Norma.',
        alt: 'The Norma Custom Carpentry home page: the name in capitals over a starfield, above the line “I named the shop after a constellation that is shaped like a carpenter’s square.”',
      },
      {
        image: '/work/norma-square.webp',
        caption: 'Scroll, and a carpenter’s square is drawn over the constellation.',
        alt: 'Further down: the outline of a carpenter’s square drawn over the stars of the constellation Norma.',
      },
      {
        image: '/work/norma-door.webp',
        caption: 'How a hidden bookshelf door works, rendered in Blender. It swings as you scroll.',
        alt: 'A rendered wall of bookshelves with one bookcase swinging inward on its hinges, and a short text headed “The Hinges”.',
      },
      {
        image: '/work/norma-sky.webp',
        caption: 'The door opens onto the same sky that runs behind the page.',
        alt: 'The same bookcase door open, the starfield showing through the doorway, and a short text headed “The Sky”.',
      },
      {
        image: '/work/norma-specialties.webp',
        caption: 'Specialties: a drawing shows how a bookshelf door turns on its hinges.',
        alt: 'The Specialties section: a line drawing of a bookshelf door on its concealed pivot hinges.',
      },
    ],
  },
];
