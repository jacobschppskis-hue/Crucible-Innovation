'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { trackScroll, type Mode } from '@/lib/scroll';

/** Hooks every `[data-scroll="view|enter|pin"]` element on the page into the shared scroll engine (CSS reads `--p`). */
export function ScrollDriver() {
  const pathname = usePathname();
  useEffect(() => {
    const offs = [...document.querySelectorAll<HTMLElement>('[data-scroll]')].map((el) =>
      trackScroll(el, (el.dataset.scroll as Mode) || 'view'),
    );
    return () => offs.forEach((off) => off());
  }, [pathname]);
  return null;
}
