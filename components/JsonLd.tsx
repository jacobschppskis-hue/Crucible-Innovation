import { site } from '@/data/site';

const founder = { '@type': 'Person', name: site.founder.name, jobTitle: site.founder.role, email: site.founder.email };
const studio = { '@type': 'Organization', '@id': `${site.url}/#crucible`, name: 'Crucible', url: site.url, email: site.email, founder };

/** schema.org structured data so search engines know who we are. No address: Crucible doesn't list one. */
export function JsonLd({ page }: { page: 'home' | 'sites' }) {
  const data =
    page === 'home'
      ? { '@context': 'https://schema.org', ...studio, logo: `${site.url}/apple-icon.png` }
      : {
          '@context': 'https://schema.org',
          '@type': 'ProfessionalService',
          name: 'Crucible Sites',
          url: `${site.url}/sites`,
          email: site.email,
          image: `${site.url}/sites/opengraph-image.png`,
          description: 'Fast, beautiful websites for local businesses, designed and built in about a week.',
          founder,
          parentOrganization: studio,
          serviceType: 'Website design and development',
        };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
