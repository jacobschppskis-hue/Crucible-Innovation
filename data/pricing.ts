export type Package = {
  id: string;
  name: string;
  summary: string;
  /** What the package does for the owner, shown big where a price used to sit. Prices are set in the quote. */
  goal: string;
  /** How it's billed, shown under the goal. Never a number. */
  care?: string;
  features: string[];
  featured?: boolean;
};

export const packages: Package[] = [
  {
    id: 'spark',
    name: 'Spark',
    summary: 'A one-page site that says who you are and how to reach you.',
    goal: 'Get online fast.',
    features: ['One-page site', 'Mobile-first design', 'Call, map and hours up front', 'Basic SEO setup'],
  },
  {
    id: 'forge',
    name: 'Forge',
    summary: 'The full storefront, and the one we recommend for most local businesses.',
    goal: 'Look established.',
    features: ['Up to 5 pages', 'Contact form', 'Google Maps embed', 'Google listing help', 'Two rounds of edits'],
    featured: true,
  },
  {
    id: 'alloy',
    name: 'Alloy',
    summary: 'A custom build, then we keep it running for you.',
    goal: 'Never think about it.',
    care: 'Build + monthly care',
    features: ['Custom build', 'Monthly edits', 'Hosting included', 'Updates and fixes'],
  },
];

export const pricingNote = 'Pricing is set in your quote, once we know what you need. No payment until you’ve approved the design.';
