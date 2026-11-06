'use client';
import { useEffect, useRef } from 'react';
import { reducedMotion } from '@/lib/scroll';
import { richTier } from '@/lib/tier';

/** Rich tier: the Thesis's molten iron (lib/gl/furnaceGL.ts) at a fixed temperature, under a Furnace's waves. */
export function FurnaceGL({ heat }: { heat: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (reducedMotion()) return;
    const canvas = ref.current!;
    const box = canvas.parentElement!;
    let stop: (() => void) | undefined;
    let dead = false;
    richTier().then(async (ok) => {
      if (!ok || dead) return;
      const { startFurnaceGL } = await import('@/lib/gl/furnaceGL');
      if (dead) return;
      stop = startFurnaceGL({
        canvas,
        heat: () => heat,
        onReady: () => box.setAttribute('data-gl', ''),
        onFail: () => box.removeAttribute('data-gl'),
      });
    });
    return () => {
      dead = true;
      stop?.();
    };
  }, [heat]);
  return <canvas ref={ref} className="furnace-gl" />;
}
