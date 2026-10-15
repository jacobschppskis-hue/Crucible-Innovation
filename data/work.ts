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
