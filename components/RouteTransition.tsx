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

  // The sheet always gets out of the way: done when its slide off the new page ends, or after a fallback timer. Neither
  // is cancelled if the path changes again straight away (e.g. Back during the slide), which used to leave the
  // attribute set for good.
  const sheet = useRef<HTMLDivElement>(null);
  const fallback = useRef(0);
  useEffect(() => {
    if (!pending.current) return;
    pending.current = false;
    const html = document.documentElement;
    html.removeAttribute('data-leaving');
    html.setAttribute('data-arriving', '');
    clearTimeout(fallback.current);
    fallback.current = window.setTimeout(() => html.removeAttribute('data-arriving'), 900);
  }, [pathname]);
  useEffect(() => {
    const el = sheet.current!;
    const done = (e: AnimationEvent) => e.target === el && e.animationName === 'route-uncover' && document.documentElement.removeAttribute('data-arriving');
    el.addEventListener('animationend', done);
    return () => el.removeEventListener('animationend', done);
  }, []);

  return (
    <div ref={sheet} aria-hidden className="route-sheet">
      <div className="route-band" />
      <div className="cast-front route-front-leave" />
      <div className="cast-front route-front-arrive" />
    </div>
  );
}
