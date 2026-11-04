import type { MetadataRoute } from 'next';
import { site } from '@/data/site';
import { ventures, type Venture } from '@/data/ventures';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const extra = (ventures as readonly Venture[]).filter((v) => !v.href).map((v) => `/ventures/${v.slug}`);
  return [
    { url: `${site.url}/`, priority: 0.8 },
    { url: `${site.url}/sites`, priority: 1 },
    { url: `${site.url}/work`, priority: 0.7 },
    { url: `${site.url}/ventures`, priority: 0.7 },
    ...extra.map((p) => ({ url: `${site.url}${p}`, priority: 0.6 })),
  ];
}
