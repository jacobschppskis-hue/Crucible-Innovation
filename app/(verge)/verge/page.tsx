import type { Metadata } from 'next';
import { VergeLanding } from '@/components/verge/VergeLanding';

// Verge's own page before launch: its landing page with a waitlist in place of sign-up. The document around it (type,
// palette, CSS) is app/(verge)/layout.tsx.

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
    images: [{ url: '/verge/og.jpg', width: 1200, height: 630, alt: 'Verge: what to train today, and why' }],
  },
  twitter: { title, description, images: ['/verge/og.jpg'] },
};

export default function VergePage() {
  return <VergeLanding />;
}
