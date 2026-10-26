'use client';
import { PACKAGE_EVENT } from './QuoteForm';

/** "Get a quote" on a pricing card: jumps to the form with that package already selected. */
export function QuoteLink({ pkg, className, children }: { pkg: string; className?: string; children: React.ReactNode }) {
  return (
    <a href="#start" className={className} onClick={() => dispatchEvent(new CustomEvent(PACKAGE_EVENT, { detail: pkg }))}>
      {children}
    </a>
  );
}
