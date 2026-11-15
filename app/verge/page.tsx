import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { VergeLanding } from '@/components/verge/VergeLanding';
import '@/components/verge/verge.css';
import '@/components/verge/verge-extra.css';

// Verge's own page before launch: its landing page in its own type and colours, with a waitlist in place of sign-up.
// Everything it needs is in components/verge and public/verge (see components/verge/README.md).

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

const title = 'Verge: what to train today, and why';
const description =
  'Verge reads your sleep, heart rate variability and resting heart rate against your own usual, then tells you what to train today. Join the waitlist.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/verge' },
  openGraph: {
    title,
    description,
    url: '/verge',
    images: [{ url: '/og/verge.jpg', width: 1200, height: 630, alt: 'Verge: a metal monolith rising out of molten metal, still glowing at its base' }],
  },
  twitter: { title, description, images: ['/og/verge.jpg'] },
};

export const viewport: Viewport = { themeColor: '#0F3B2E', colorScheme: 'dark' };

export default function VergePage() {
  return (
    <div className={`verge-page ${schibsted.variable}`} style={PALETTE}>
      <VergeLanding />
    </div>
  );
}
