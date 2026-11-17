import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { RefTracker } from '@/components/RefTracker';
import { site } from '@/data/site';
import '@/components/verge/verge.css';
import '@/components/verge/verge-extra.css';

// Verge's own document. /verge previews Verge, so it is Verge and nothing else: its type, its palette, its focus ring,
// its skip link, as in the Verge repo's app/layout.tsx. None of Crucible's CSS, fonts or effects load here (they live
// in app/(site)), and leaving /verge for another page is a full page load. Everything it needs is in components/verge
// and public/verge (see components/verge/README.md).

// Schibsted Grotesk, Verge's one family (OFL, components/verge/fonts/OFL.txt): the Latin cut, weights 400 to 900.
const schibsted = localFont({
  src: '../../components/verge/fonts/SchibstedGrotesk-latin-wght400-900.woff2',
  weight: '400 900',
  variable: '--font-schibsted',
  display: 'swap',
  adjustFontFallback: 'Arial',
});

// Verge's palette (Spruce, from its lib/palette.ts): --f-* for the dark field, --r-* for the light reading ground.
const PALETTE = {
  "--f-scheme": "dark",
  "--f-ground": "#0F3B2E",
  "--f-ground-2": "#0A2E23",
  "--f-ink": "#F3EFE4",
  "--f-ink-muted": "#B7CBBE",
  "--f-hairline": "#3F6A5A",
  "--f-accent": "#C9F24D",
  "--f-accent-text": "#C9F24D",
  "--f-on-accent": "#0A2A20",
  "--f-success": "#A6EBC0",
  "--f-warning": "#FFD98A",
  "--f-danger": "#FFB8AB",
  "--f-zone-1": "#B7CBBE",
  "--f-zone-2": "#9FD8F2",
  "--f-zone-3": "#A6EBC0",
  "--f-zone-4": "#FFD98A",
  "--f-zone-5": "#FFB8AB",
  "--r-scheme": "light",
  "--r-ground": "#F5F2E9",
  "--r-ground-2": "#EAE6D9",
  "--r-ink": "#0D2A21",
  "--r-ink-muted": "#4A6358",
  "--r-hairline": "#CFCDBD",
  "--r-accent": "#1B6B4F",
  "--r-accent-text": "#1B6B4F",
  "--r-on-accent": "#F5F2E9",
  "--r-success": "#1D6B3C",
  "--r-warning": "#7A5200",
  "--r-danger": "#A3301B",
  "--r-zone-1": "#4A6358",
  "--r-zone-2": "#1F5F8B",
  "--r-zone-3": "#1D6B3C",
  "--r-zone-4": "#7A5200",
  "--r-zone-5": "#A3301B",
} as React.CSSProperties;

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  applicationName: 'Verge',
  icons: { icon: [{ url: '/verge/icon.svg', type: 'image/svg+xml' }], apple: '/verge/apple-icon.png' },
  openGraph: { type: 'website', siteName: 'Verge', locale: 'en_US' },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = { themeColor: '#0F3B2E', viewportFit: 'cover' };

export default function VergeLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`verge-page ${schibsted.variable}`} style={PALETTE}>
      <head>
        {/* The site's analytics (Umami), when the UMAMI_WEBSITE_ID repo variable is set: it only counts visits. */}
        {process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID && (
          <script defer src="https://cloud.umami.is/script.js" data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID} />
        )}
      </head>
      <body className="min-h-screen bg-ground font-body text-ink antialiased">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
        {/* Keeps ?ref= for the visit, so the waitlist can say where someone came from. Renders nothing. */}
        <RefTracker />
      </body>
    </html>
  );
}
