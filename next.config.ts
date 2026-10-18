import type { NextConfig } from 'next';

// Static export: `next build` writes plain HTML/CSS/JS to `out/`, which GitHub Pages serves
// (see .github/workflows/deploy.yml). GitHub Pages handles the custom domain and the www redirect.
const nextConfig: NextConfig = {
  output: 'export',
  // GitHub Pages can't resize images, so showcase screenshots ship pre-sized (640/960/1440 wide)
  // and lib/imageLoader.ts points each srcset entry at the right file.
  images: { loader: 'custom', loaderFile: './lib/imageLoader.ts', deviceSizes: [640, 960, 1440], imageSizes: [320, 480] },
};

export default nextConfig;
