// Static-export image loader. Showcase screenshots exist at these widths:
// name.webp (1440), name-960.webp, name-640.webp. See showcase-src/render.mjs.
const VARIANTS = [640, 960];

export default function imageLoader({ src, width }: { src: string; width: number; quality?: number }) {
  if (!src.startsWith('/showcase/') || !src.endsWith('.webp')) return src;
  const w = VARIANTS.find((v) => v >= width);
  return w ? src.replace(/\.webp$/, `-${w}.webp`) : src;
}
