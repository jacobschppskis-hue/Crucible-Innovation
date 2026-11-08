'use client';
import Image from 'next/image';
import { useEffect, useRef } from 'react';
import './Crt.css';

/**
 * The CRT portrait image (scripts/crt-portraits.py). It must already be there after a fast scroll, but must not compete
 * with the headline during load (~200 KB each): lazy at first, then eager once the page is loaded and idle, or as soon
 * as it is within three viewports (whichever comes first). The tube powers on (Crt.css) once a third of it is in view.
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
    // power on: the box (.crt) gets data-on once, when a third of it is on screen
    const box = el.parentElement!;
    const on = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) {
        box.setAttribute('data-on', '');
        on?.disconnect();
      }
    }, { threshold: 0.33 });
    if (on) on.observe(box);
    else box.setAttribute('data-on', '');
    const later = () => {
      const ric = (window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
      if (ric) ric(go, { timeout: 1000 });
      else setTimeout(go, 1000);
    };
    if (document.readyState === 'complete') later();
    else window.addEventListener('load', later, { once: true });
    return () => {
      io?.disconnect();
      on?.disconnect();
      window.removeEventListener('load', later);
    };
  }, []);
  return <Image ref={ref} src={src} alt={alt} width={800} height={960} sizes={sizes} loading="lazy" fetchPriority="low" draggable={false} className="crt-img absolute inset-0 h-full w-full object-contain" />;
}
