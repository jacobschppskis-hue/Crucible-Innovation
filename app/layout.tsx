import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { InView } from '@/components/InView';
import { Magnetic } from '@/components/Magnetic';
import { Liquid } from '@/components/Liquid';
import { ScrollDriver } from '@/components/ScrollDriver';
import { ReadingHeat } from '@/components/ReadingHeat';
import { RefTracker } from '@/components/RefTracker';
import { RouteTransition } from '@/components/RouteTransition';
import { SmoothScroll } from '@/components/SmoothScroll';
import { site } from '@/data/site';
import { TIER_SCRIPT } from '@/lib/tier';
import './globals.css';
// Shared by every page (menu, packages, before/after). Each other component's stylesheet is imported by the component
// (or the page) that uses it, so a route only ships the CSS it renders.
import '@/components/Sites.css';

// One family for the whole site. The width axis does the display work: Expanded (wdth 125) for display type, normal
// width for text. The concept sites on /sites bring their own faces (lib/conceptFonts.ts).
// Self-hosted: Archivo's variable font (OFL) cut to the Latin glyphs and punctuation we set, wght 400-800 and wdth
// 100-125, the only ranges used (44 KB instead of the 90 KB Google file, which sits on the critical path before first
// paint). Regenerate: fontTools.varLib.instancer wght=400:800 wdth=100:125, then pyftsubset (see .board/status/T36.md).
const archivo = localFont({
  src: './fonts/Archivo-latin-wght400-800-wdth100-125.woff2',
  weight: '400 800',
  style: 'normal',
  variable: '--font-archivo',
  display: 'swap',
  adjustFontFallback: 'Arial',
  declarations: [{ prop: 'font-stretch', value: '100% 125%' }],
});

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
      </head>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-bone focus:px-4 focus:py-2 focus:text-ground">
          Skip to content
        </a>
        {children}
        <Liquid />
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
