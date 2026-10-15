export type Venture = {
  slug: string;
  name: string;
  blurb: string;
  status: 'live' | 'forging';
  /** Where the card links. Omit it and a page is generated at /ventures/[slug]. */
  href?: string;
  /** Longer copy for the generated /ventures/[slug] page. */
  description?: string;
};

// Adding a venture = adding one entry here. `forging` cards render dimmed with no link.
export const ventures = [
  { slug: 'sites', name: 'Crucible Sites', blurb: 'Websites for local businesses, built in days.', status: 'live', href: '/sites' },
  { slug: 'tbd-1', name: 'Untitled', blurb: 'In the furnace.', status: 'forging' },
  { slug: 'tbd-2', name: 'Untitled', blurb: 'In the furnace.', status: 'forging' },
] as const satisfies readonly Venture[];

export const ventureHref = (v: Venture) => v.href ?? `/ventures/${v.slug}`;
