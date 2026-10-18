export type Package = {
  id: string;
  name: string;
  summary: string;
  /** Starting price; the quote confirms the final number. */
  price: string;
  /** Recurring part of the package, shown under the price. */
  care?: string;
  features: string[];
  featured?: boolean;
};

// Launch prices: deliberately accessible while there's no client portfolio yet. Revisit after the first few clients.
export const packages: Package[] = [
  {
    id: 'spark',
    name: 'Spark',
    summary: 'A one-page site that says who you are and how to reach you.',
    price: '$250',
    features: ['One-page site', 'Mobile-first design', 'Call, map and hours up front', 'Basic SEO setup'],
  },
  {
    id: 'forge',
    name: 'Forge',
    summary: 'The full storefront. Most local businesses start here.',
    price: '$500',
    features: ['Up to 5 pages', 'Contact form', 'Google Maps embed', 'Google listing help', 'Two rounds of edits'],
    featured: true,
  },
  {
    id: 'alloy',
    name: 'Alloy',
    summary: 'A custom build, then we keep it running for you.',
    price: '$800',
    care: '+ $50/mo care',
    features: ['Custom build', 'Monthly edits', 'Hosting included', 'Updates and monitoring'],
  },
];

export const pricingNote = 'Final price is confirmed in your quote. No payment until you’ve approved the design.';

/** For structured data (schema.org priceRange). */
export const priceRange = '$250–$800';
