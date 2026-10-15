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

/** Keeps ?ref= for the session so it's attached to quote requests (analytics records it as the visit's source). */
export function RefTracker() {
  useEffect(() => {
    const ref = new URLSearchParams(location.search).get('ref')?.slice(0, 64);
    if (!ref) return;
    try {
      sessionStorage.setItem(KEY, ref);
    } catch {}
  }, []);
  return null;
}
