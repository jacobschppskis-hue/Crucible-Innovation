'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

const LEAVE_MS = 420;

/**
 * Moving between pages (e.g. / → /sites) pours the next page in: a sheet of ground slides down over the page behind an
 * Ember front, the route changes underneath, and the sheet carries on down off the new page. Only for same-site links
 * to a different page, plain left clicks, and motion allowed; everything else (new tab, back/forward, same-page
 * anchors, reduced motion) is ordinary navigation.
 */
export function RouteTransition() {
  const router = useRouter();
  const pathname = usePathname();
  const pending = useRef(false);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const a = (e.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      e.preventDefault();
      const html = document.documentElement;
      if (html.hasAttribute('data-leaving')) return;
      html.setAttribute('data-leaving', '');
      pending.current = true;
      window.setTimeout(() => router.push(url.pathname + url.search + url.hash), LEAVE_MS);
    };
    // Capture, so this runs before Next's own <Link> handler.
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [router]);

  useEffect(() => {
    if (!pending.current) return;
    pending.current = false;
    const html = document.documentElement;
    html.removeAttribute('data-leaving');
    html.setAttribute('data-arriving', '');
    const id = window.setTimeout(() => html.removeAttribute('data-arriving'), 900);
    return () => clearTimeout(id);
  }, [pathname]);

  return (
    <div aria-hidden className="route-sheet">
      <div className="route-band" />
      <div className="cast-front route-front-leave" />
      <div className="cast-front route-front-arrive" />
    </div>
  );
}
