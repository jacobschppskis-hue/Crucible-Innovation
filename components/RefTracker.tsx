'use client';
import { useEffect } from 'react';
import { track } from '@vercel/analytics';

const KEY = 'crucible:ref';

/** Reads the ref (e.g. ?ref=card from the business card QR) for the current session. */
export function getRef(): string {
  try {
    return sessionStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

/** Captures ?ref= once per session: logged as an analytics event and attached to quote requests. */
export function RefTracker() {
  useEffect(() => {
    const ref = new URLSearchParams(location.search).get('ref')?.slice(0, 64);
    if (!ref) return;
    try {
      if (sessionStorage.getItem(KEY) === ref) return;
      sessionStorage.setItem(KEY, ref);
    } catch {}
    track('Referral', { ref, path: location.pathname });
  }, []);
  return null;
}
