'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/** One shared IntersectionObserver for every [data-reveal] / [data-words] / [data-cast] element: sets data-in at 15% visibility. */
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
    return () => io.disconnect();
  }, [pathname]);
  return null;
}
