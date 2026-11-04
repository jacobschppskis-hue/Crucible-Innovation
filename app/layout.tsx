import type { Metadata, Viewport } from 'next';
import { Archivo } from 'next/font/google';
import { InView } from '@/components/InView';
import { Magnetic } from '@/components/Magnetic';
import { ScrollDriver } from '@/components/ScrollDriver';
import { ReadingHeat } from '@/components/ReadingHeat';
import { RefTracker } from '@/components/RefTracker';
import { RouteTransition } from '@/components/RouteTransition';
import { SmoothScroll } from '@/components/SmoothScroll';
import { site } from '@/data/site';
import { TIER_SCRIPT } from '@/lib/tier';
import './globals.css';
// Bundled with the global CSS (one stylesheet request per page; these are only ~4 KB gzipped).
import '@/components/LiveSite.css';
import '@/components/BuildStage.css';
import '@/components/Story.css';
import '@/components/Ventures.css';
import '@/components/TryIt.css';
import '@/components/Sites.css';

// One family for the whole site. The width axis does the display work: Expanded (wdth 125) for display type, normal
// width for text. The concept sites on /sites bring their own faces (lib/conceptFonts.ts).
const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--font-archivo', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: 'Crucible: a studio that ships ventures', template: '%s' },
  description: 'Crucible is a studio that builds and ships ventures. Exceptional people, serious machines, new things.',
  applicationName: 'Crucible',
  authors: site.founders.map((f) => ({ name: f.name })),
  icons: { icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }], apple: '/apple-icon.png' },
  openGraph: { type: 'website', siteName: 'Crucible', locale: 'en_US' },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = { themeColor: '#0D0D0B', colorScheme: 'dark' };

// Without JS the nav never learns it has scrolled, so give it its solid background up front.
const noJs = `.nav{background:rgba(13,13,11,.85)}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={archivo.variable}>
      <head>
        {/* Sets html.js, the visual tier and the intro tempo before first paint (see lib/tier.ts). */}
        <script dangerouslySetInnerHTML={{ __html: TIER_SCRIPT }} />
        {/* Analytics (Umami): set the UMAMI_WEBSITE_ID repo variable to turn it on. See README. */}
        {process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID && (
          <script defer src="https://cloud.umami.is/script.js" data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID} />
        )}
        <noscript>
          <style dangerouslySetInnerHTML={{ __html: noJs }} />
        </noscript>
      </head>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-bone focus:px-4 focus:py-2 focus:text-ground">
          Skip to content
        </a>
        {children}
        <InView />
        <ReadingHeat />
        <ScrollDriver />
        <Magnetic />
        <SmoothScroll />
        <RefTracker />
        <RouteTransition />
      </body>
    </html>
  );
}
