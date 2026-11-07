'use client';
import Image from 'next/image';
import { useEffect, useRef } from 'react';

/**
 * The ASCII portrait image. It must already be there after a fast scroll, but must not compete with the headline
 * during load (~90 KB each): lazy at first, then eager once the page is loaded and idle, or as soon as it is within
 * three viewports (whichever comes first).
 */
export function PortraitImg({ src, alt, sizes }: { src: string; alt: string; sizes: string }) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      el.loading = 'eager';
      io?.disconnect();
    };
    const io = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && go(), { rootMargin: '300% 0px 300% 0px' });
    io?.observe(el);
    const later = () => {
      const ric = (window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
      if (ric) ric(go, { timeout: 1000 });
      else setTimeout(go, 1000);
    };
    if (document.readyState === 'complete') later();
    else window.addEventListener('load', later, { once: true });
    return () => {
      io?.disconnect();
      window.removeEventListener('load', later);
    };
  }, []);
  return <Image ref={ref} src={src} alt={alt} width={800} height={956} sizes={sizes} loading="lazy" fetchPriority="low" draggable={false} className="absolute inset-0 h-full w-full object-contain" />;
}
