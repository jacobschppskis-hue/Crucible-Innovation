import type { NextConfig } from 'next';

// Static export: `next build` writes plain HTML/CSS/JS to `out/`, which GitHub Pages serves
// (see .github/workflows/deploy.yml). GitHub Pages handles the custom domain and the www redirect.
const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
};

export default nextConfig;
