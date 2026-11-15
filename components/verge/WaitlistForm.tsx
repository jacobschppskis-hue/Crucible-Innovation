'use client';
import { useRef, useState } from 'react';
import { site } from '@/data/site';
import { getRef } from '@/components/RefTracker';

// The Verge waitlist. It posts the way the /sites quote form does: to Formspree when the FORMSPREE_ID repo variable is
// set (as its own form, verge-waitlist), and otherwise it writes the request as an email the visitor sends, which gives
// no list. Without JS the form posts to the same place, or opens a mail app.

const SPORTS = ['Running', 'Cycling', 'Triathlon', 'Cross-country skiing', 'Cyclocross', 'Other'];
const WEARS = ['Garmin', 'Apple Watch', 'Coros', 'Polar', 'Oura', 'Whoop', 'Other', 'None'];

type Status = 'idle' | 'sending' | 'sent' | 'compose' | 'error';

const to = site.email;
const endpoint = site.formspreeId ? `https://formspree.io/f/${site.formspreeId}` : undefined;
const enc = encodeURIComponent;
const SUBJECT = 'Verge waitlist';

// Verge's own control and button styles (its components/ui/Field.tsx and Button.tsx), so the form matches the page.
const CONTROL =
  'block min-h-48 w-full appearance-none border-[1.5px] border-muted bg-transparent px-12 py-8 text-body text-ink transition-colors placeholder:text-muted hover:border-ink focus:border-ink disabled:cursor-not-allowed disabled:opacity-50';
const BUTTON =
  'inline-flex select-none items-center justify-center text-center font-bold transition-[opacity,background-color] disabled:cursor-not-allowed min-h-[56px] gap-12 px-24 text-lead sm:px-32 bg-ink text-ground hover:opacity-85 active:opacity-75 shrink-0';
const CHEVRON = (
  <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" className="pointer-events-none absolute right-16 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 6l5 5 5-5" />
  </svg>
);

function mailto(form: HTMLFormElement) {
  const f = new FormData(form);
  const v = (k: string) => String(f.get(k) ?? '').trim();
  const body = [
    'Please add me to the Verge waitlist.',
    '',
    `Email: ${v('email')}`,
    `Main sport: ${v('sport') || 'Not given'}`,
    `Wears: ${v('wears') || 'Not given'}`,
    `Private beta: ${v('beta') ? 'Yes, please consider me' : 'No'}`,
    '',
    'Sent from crucibleinnovation.com/verge',
  ].join('\n');
  return `mailto:${to}?subject=${enc(SUBJECT)}&body=${enc(body)}`;
}

export function WaitlistForm({ className = '' }: { className?: string }) {
  const [status, setStatus] = useState<Status>('idle');
  const [draft, setDraft] = useState<string | null>(null);
  const done = useRef<HTMLDivElement>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity()) return;
    if (!endpoint) {
      const link = mailto(form);
      setDraft(link);
      setStatus('compose');
      // Phones almost always have a mail app: open it at once, as the quote form does. The panel stays as a fallback.
      if (matchMedia('(hover: none)').matches) location.href = link;
      return;
    }
    const data = new FormData(form);
    data.set('beta', data.get('beta') ? 'yes' : 'no');
    data.set('ref', getRef());
    data.set('page', location.pathname);
    setStatus('sending');
    try {
      const res = await fetch(endpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(String(res.status));
      form.reset();
      setStatus('sent');
      requestAnimationFrame(() => done.current?.focus());
    } catch {
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <div id="waitlist" ref={done} tabIndex={-1} role="status" className={`max-w-[34em] scroll-mt-32 outline-none ${className}`}>
        <p className="font-display text-title">You’re on the list</p>
        <p className="mt-8 text-body">We’ll email you about Verge, and only about Verge.</p>
      </div>
    );
  }

  if (status === 'compose' && draft) {
    return (
      <div id="waitlist" role="status" className={`max-w-[34em] scroll-mt-32 ${className}`}>
        <p className="text-body">Your email app should open with the message written. Press send and you’re on the list.</p>
        <a href={draft} className={`${BUTTON} mt-16`}>
          Open the email
        </a>
        <p className="mt-12 text-small text-muted">
          Or email <a href={`mailto:${to}?subject=${enc(SUBJECT)}`} className="underline decoration-1 underline-offset-4">{to}</a> with the subject “{SUBJECT}”.
        </p>
      </div>
    );
  }

  return (
    <form
      id="waitlist"
      name="verge-waitlist"
      action={endpoint ?? `mailto:${to}?subject=${enc(SUBJECT)}`}
      method="POST"
      encType={endpoint ? undefined : 'text/plain'}
      onSubmit={onSubmit}
      onInput={() => status === 'error' && setStatus('idle')}
      aria-label="Verge waitlist"
      className={`max-w-[34em] scroll-mt-32 ${className}`}
    >
      <input type="hidden" name="_subject" defaultValue={SUBJECT} />
      <input type="hidden" name="form" defaultValue="verge-waitlist" />
      <input type="hidden" name="ref" defaultValue="" />
      {/* Honeypot: people never see or fill this. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-[1px] w-[1px] overflow-hidden">
        <label>
          Leave this empty
          <input type="text" name="_gotcha" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label htmlFor="waitlist-email" className="block text-body font-medium">
        Your email
      </label>
      <div className="mt-8 flex flex-col gap-12 sm:flex-row">
        <input id="waitlist-email" name="email" type="email" required autoComplete="email" inputMode="email" className={`${CONTROL} min-h-[56px] sm:flex-1`} />
        <button type="submit" disabled={status === 'sending'} className={BUTTON}>
          {status === 'sending' ? 'Sending…' : 'Get early access'}
        </button>
      </div>

      <div className="mt-16 grid gap-16 sm:grid-cols-2">
        <div>
          <label htmlFor="waitlist-sport" className="block text-small text-muted">
            Main sport, if you like
          </label>
          <div className="relative mt-8">
            <select id="waitlist-sport" name="sport" defaultValue="" className={`${CONTROL} pr-48`}>
              <option value="">Choose one</option>
              {SPORTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            {CHEVRON}
          </div>
        </div>
        <div>
          <label htmlFor="waitlist-wears" className="block text-small text-muted">
            What you wear, if you like
          </label>
          <div className="relative mt-8">
            <select id="waitlist-wears" name="wears" defaultValue="" className={`${CONTROL} pr-48`}>
              <option value="">Choose one</option>
              {WEARS.map((w) => (
                <option key={w}>{w}</option>
              ))}
            </select>
            {CHEVRON}
          </div>
        </div>
      </div>

      <label className="mt-16 flex min-h-target items-center gap-12 text-body">
        <input type="checkbox" name="beta" value="yes" className="h-[20px] w-[20px] shrink-0 accent-[var(--ink)]" />
        I’d like to be considered for the private beta.
      </label>

      {status === 'error' && (
        <p role="alert" className="mt-12 text-body font-medium text-danger">
          That didn’t go through. Try again in a moment, or email {to}.
        </p>
      )}
      <p className="mt-12 text-small text-muted">We’ll only email you about Verge.</p>
    </form>
  );
}
