'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * One shared IntersectionObserver for every [data-reveal] / [data-words] / [data-cast] element: sets data-in at 15%
 * visibility. A second one keeps data-live on [data-heat] elements while they're on screen (their loops pause off it).
 */
export function InView() {
  const pathname = usePathname();
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute('data-in', '');
          io.unobserve(e.target);
        }
      },
      { threshold: 0.15 },
    );
    document.querySelectorAll('[data-reveal]:not([data-in]), [data-words]:not([data-in]), [data-cast]:not([data-in])').forEach((el) => io.observe(el));
    const live = new IntersectionObserver((entries) => {
      for (const e of entries) e.target.toggleAttribute('data-live', e.isIntersecting);
    });
    document.querySelectorAll('[data-heat]').forEach((el) => live.observe(el));
    return () => {
      io.disconnect();
      live.disconnect();
    };
  }, [pathname]);
  return null;
}
