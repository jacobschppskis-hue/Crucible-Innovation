'use client';
import { useEffect } from 'react';

const KEY = 'crucible:ref';

/** Reads the ref (e.g. ?ref=card from the business card QR) for the current session. */
export function getRef(): string {
  try {
    return sessionStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

type Umami = { track: (event: string, data?: Record<string, string>) => void };

/** Keeps ?ref= for the session so it's attached to quote requests, and logs it as an analytics event. */
export function RefTracker() {
  useEffect(() => {
    const ref = new URLSearchParams(location.search).get('ref')?.slice(0, 64);
    if (!ref) return;
    try {
      if (sessionStorage.getItem(KEY) === ref) return; // count once per visit
      sessionStorage.setItem(KEY, ref);
    } catch {}
    // The analytics script loads deferred, so wait briefly for it (gives up after ~5s, e.g. if blocked).
    let tries = 0;
    const id = setInterval(() => {
      const umami = (window as unknown as { umami?: Umami }).umami;
      if (umami) umami.track('Referral', { ref });
      if (umami || ++tries > 10) clearInterval(id);
    }, 500);
    return () => clearInterval(id);
  }, []);
  return null;
}
