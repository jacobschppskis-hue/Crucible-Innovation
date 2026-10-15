import { ogSize, renderOg } from '@/lib/og';

export const alt = 'Crucible Sites: websites for local businesses';
export const size = ogSize;
export const contentType = 'image/png';

export default function Image() {
  return renderOg({ sites: true, caption: 'WEBSITES FOR LOCAL BUSINESSES' });
}
