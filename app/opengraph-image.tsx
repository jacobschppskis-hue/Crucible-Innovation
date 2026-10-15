import { ogSize, renderOg } from '@/lib/og';

export const alt = 'Crucible: a studio that ships ventures';
export const size = ogSize;
export const contentType = 'image/png';

export default function Image() {
  return renderOg({ sites: false, caption: 'A STUDIO THAT SHIPS VENTURES' });
}
