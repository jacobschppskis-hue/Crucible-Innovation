export type Package = {
  id: string;
  name: string;
  summary: string;
  price: string;
  cadence?: string;
  features: string[];
  featured?: boolean;
};

// TODO(jakob): placeholder prices. Replace every `$TBD` before launch.
export const packages: Package[] = [
  {
    id: 'spark',
    name: 'Spark',
    summary: 'A one-page site that says who you are and how to reach you.',
    price: '$TBD', // TODO(jakob)
    features: ['One-page site', 'Mobile-first design', 'Call, map and hours up front', 'Basic SEO setup'],
  },
  {
    id: 'forge',
    name: 'Forge',
    summary: 'The full storefront. Most local businesses start here.',
    price: '$TBD', // TODO(jakob)
    features: ['Up to 5 pages', 'Contact form', 'Google Maps embed', 'Google listing help', 'Two rounds of edits'],
    featured: true,
  },
  {
    id: 'alloy',
    name: 'Alloy',
    summary: 'A custom build, then we keep it running for you.',
    price: '$TBD', // TODO(jakob)
    cadence: '/mo',
    features: ['Custom build', 'Monthly edits', 'Hosting included', 'Updates and monitoring'],
  },
];

export const pricingNote = 'Final price is confirmed in your quote. No payment until you’ve approved the design.';
