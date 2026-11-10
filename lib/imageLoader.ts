// Static-export image loader. Screenshots exist at these widths: name.webp (1440), name-960.webp, name-640.webp.
// The concept sites' come from showcase-src/render.mjs, a client site's from scripts/shoot-client.mjs.
const VARIANTS = [640, 960];
const SIZED = /^\/(showcase|work)\/[^/]+\.webp$/;

export default function imageLoader({ src, width }: { src: string; width: number; quality?: number }) {
  if (!SIZED.test(src)) return src;
  const w = VARIANTS.find((v) => v >= width);
  return w ? src.replace(/\.webp$/, `-${w}.webp`) : src;
}
