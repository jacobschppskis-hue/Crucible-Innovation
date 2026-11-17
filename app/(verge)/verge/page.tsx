import type { Metadata } from 'next';
import { VergeLanding } from '@/components/verge/VergeLanding';

// Verge's own page before launch: its landing page with a waitlist in place of sign-up. The document around it (type,
// palette, CSS) is app/(verge)/layout.tsx.

// Verge's own title and description (the Verge repo's PRODUCT_NAME and PRODUCT_DESCRIPTION).
const title = 'Verge';
const description =
  'Every morning Verge reads your sleep, heart rate variability and resting heart rate, then tells you what to do that day and why.';

export const metadata: Metadata = {
  // absolute: the page's title is Verge's, with nothing added by a template.
  title: { absolute: title },
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
