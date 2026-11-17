import { SiteDocument, siteMetadata, siteViewport } from '../site-document';

// The root layout for every Crucible page (/, /sites, /work, /ventures). /verge has its own (app/(verge)/layout.tsx).
export const metadata = siteMetadata;
export const viewport = siteViewport;

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteDocument>{children}</SiteDocument>;
}
