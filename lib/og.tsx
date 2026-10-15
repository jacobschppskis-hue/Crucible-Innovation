import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { splitRingSvg } from './splitRing';

export const ogSize = { width: 1200, height: 630 };

/** Split Ring on Ground with the Spark wordmark. Rendered at build time. */
export async function renderOg({ sites, caption }: { sites: boolean; caption: string }) {
  const [archivo, mono] = await Promise.all([
    readFile(join(process.cwd(), 'assets/fonts/Archivo-SemiBold.woff')),
    readFile(join(process.cwd(), 'assets/fonts/JetBrainsMono-Medium.woff')),
  ]);
  const ring = `data:image/svg+xml;base64,${Buffer.from(splitRingSvg()).toString('base64')}`;
  const fs = 132;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at 50% 38%, #1d1a12 0%, #0D0D0B 55%)',
          color: '#E8E4D8',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ring} width={200} height={200} alt="" />
        <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 36, gap: 28 }}>
          <div style={{ display: 'flex', fontFamily: 'Archivo', fontSize: fs, letterSpacing: -0.03 * fs, lineHeight: 1 }}>
            <span>cruc</span>
            <span style={{ position: 'relative', display: 'flex' }}>
              ı
              <span
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: 0.1 * fs,
                  width: 0.14 * fs,
                  height: 0.14 * fs,
                  marginLeft: -0.07 * fs,
                  borderRadius: 999,
                  background: '#FF5B1F',
                }}
              />
            </span>
            <span>ble</span>
          </div>
          {sites && <div style={{ fontFamily: 'JetBrains Mono', fontSize: 0.62 * fs * 0.62, letterSpacing: 0.14 * 30, color: 'rgba(232,228,216,0.56)' }}>SITES</div>}
        </div>
        <div style={{ marginTop: 40, fontFamily: 'JetBrains Mono', fontSize: 24, letterSpacing: 3, color: 'rgba(232,228,216,0.56)' }}>{caption}</div>
      </div>
    ),
    {
      ...ogSize,
      fonts: [
        { name: 'Archivo', data: archivo, weight: 600, style: 'normal' },
        { name: 'JetBrains Mono', data: mono, weight: 500, style: 'normal' },
      ],
    },
  );
}
