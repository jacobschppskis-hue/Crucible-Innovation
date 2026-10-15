import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Every route is statically prerendered at build time (see `next build` output).
  // We don't use `output: 'export'` so Vercel can still optimize images and apply the redirect below.
  poweredByHeader: false,
  images: { formats: ['image/avif', 'image/webp'] },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.crucibleinnovation.com' }],
        destination: 'https://crucibleinnovation.com/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
