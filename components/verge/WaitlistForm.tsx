'use client';
import { useEffect, useRef, useState } from 'react';
import { site } from '@/data/site';
import { getRef } from '@/components/RefTracker';

// The Verge waitlist. With a waitlist form ID (the FORMSPREE_WAITLIST_ID repo variable, never the quote form's
// FORMSPREE_ID) it posts to Formspree in place. Without one, which is how it ships for now, it writes the request as an
// email the visitor sends: from their mail app, Gmail or Outlook, or copied, the way the /sites quote form does. Phones
// open the mail app at once. Without JavaScript the form posts to the same place, or opens a mail app.

const SPORTS = ['Running', 'Cycling', 'Triathlon', 'Cross-country skiing', 'Cyclocross', 'Other'];
const WEARS = ['Garmin', 'Apple Watch', 'Coros', 'Polar', 'Oura', 'Whoop', 'Other', 'None'];

type Status = 'idle' | 'sending' | 'sent' | 'compose' | 'error';
type Draft = { subject: string; body: string };

const to = site.email;
const endpoint = site.formspreeWaitlistId ? `https://formspree.io/f/${site.formspreeWaitlistId}` : undefined;
const enc = encodeURIComponent;
const SUBJECT = 'Verge waitlist';
const EMAIL_MISSING = 'Add your email to get early access';
const EMAIL_INVALID = 'That email doesn’t look quite right';

// Verge's own control, button and link styles (its components/ui/Field.tsx and Button.tsx), so the form matches the page.
const CONTROL =
  'block min-h-48 w-full appearance-none border-[1.5px] border-muted bg-transparent px-12 py-8 text-body text-ink transition-colors placeholder:text-muted hover:border-ink focus:border-ink disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger';
const BASE = 'inline-flex shrink-0 select-none items-center justify-center text-center font-bold transition-[opacity,background-color] disabled:cursor-not-allowed';
const PRIMARY_LG = `${BASE} min-h-[56px] gap-12 px-24 text-lead sm:px-32 bg-ink text-ground hover:opacity-85 active:opacity-75`;
const PRIMARY = `${BASE} min-h-48 gap-8 px-24 text-body bg-ink text-ground hover:opacity-85 active:opacity-75`;
const SECONDARY = `${BASE} min-h-48 gap-8 px-24 text-body border-[1.5px] border-ink text-ink hover:bg-ground-2 active:bg-ground-2`;
const TEXT_BUTTON = '-my-12 inline-flex min-h-target items-center font-medium text-ink underline decoration-1 underline-offset-4 hover:decoration-2';
const CHEVRON = (
  <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" className="pointer-events-none absolute right-16 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 6l5 5 5-5" />
  </svg>
);

function compose(form: HTMLFormElement): Draft {
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
  return { subject: SUBJECT, body };
}

const links = ({ subject, body }: Draft) => ({
  mailto: `mailto:${to}?subject=${enc(subject)}&body=${enc(body)}`,
  gmail: `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(to)}&su=${enc(subject)}&body=${enc(body)}`,
  outlook: `https://outlook.live.com/mail/0/deeplink/compose?to=${enc(to)}&subject=${enc(subject)}&body=${enc(body)}`,
});

/**
 * The request, written as an email, and the ways to send it. It never says an email opened: on a computer a mail link
 * can do nothing at all, so it says what to do either way.
 */
function SendPanel({ draft, tried, onEdit }: { draft: Draft; tried: boolean; onEdit: () => void }) {
  const [step, setStep] = useState<'ready' | 'tried' | 'copied'>(tried ? 'tried' : 'ready');
  const heading = useRef<HTMLHeadingElement>(null);
  const l = links(draft);
  useEffect(() => heading.current?.focus(), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`To: ${to}\nSubject: ${draft.subject}\n\n${draft.body}`);
      setStep('copied');
    } catch {
      setStep('tried');
    }
  };

  return (
    <div>
      <h2 ref={heading} tabIndex={-1} className="font-display text-title">
        Send it from your email
      </h2>
      <p className="mt-8 text-body" aria-live="polite">
        {step === 'ready'
          ? 'Your request is written and addressed to us. Pick where to send it from, then press send.'
          : step === 'copied'
            ? `The message is copied. Paste it into a new email to ${to} and send it.`
            : 'If an email opened with your request in it, press send and you’re on the list. If nothing opened, try another way below.'}
      </p>
      <div className="mt-24 grid gap-12 sm:grid-cols-2">
        <a href={l.mailto} onClick={() => setStep('tried')} className={PRIMARY}>
          Mail app
        </a>
        <a href={l.gmail} target="_blank" rel="noopener" onClick={() => setStep('tried')} className={SECONDARY}>
          Gmail
        </a>
        <a href={l.outlook} target="_blank" rel="noopener" onClick={() => setStep('tried')} className={SECONDARY}>
          Outlook
        </a>
        <button type="button" onClick={copy} className={SECONDARY}>
          {step === 'copied' ? 'Copied' : 'Copy message'}
        </button>
      </div>
      <p className="mt-16 text-small text-muted">
        Or email{' '}
        <a href={`mailto:${to}?subject=${enc(SUBJECT)}`} className="underline decoration-1 underline-offset-4 hover:decoration-2">
          {to}
        </a>{' '}
        with the subject “{SUBJECT}”.
      </p>
      <p className="mt-16 text-body">
        <button type="button" onClick={onEdit} className={TEXT_BUTTON}>
          Change my answers
        </button>
      </p>
    </div>
  );
}

/** The waitlist. `beside` sits next to the button, where the landing page's second button goes. */
export function WaitlistForm({ className = '', beside }: { className?: string; beside?: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('idle');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tried, setTried] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const done = useRef<HTMLDivElement>(null);

  // With JavaScript the email is checked here, with a note under the field. Without it the browser checks it.
  useEffect(() => {
    if (formRef.current) formRef.current.noValidate = true;
  }, []);

  function flagEmail(msg: string) {
    setEmailError(msg);
    emailRef.current?.focus();
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = emailRef.current;
    if (email && !email.value.trim()) return flagEmail(EMAIL_MISSING);
    if (email && !email.checkValidity()) return flagEmail(EMAIL_INVALID);
    if (!endpoint) {
      const d = compose(form);
      // Phones almost always have a mail app: open it at once, as the quote form does. The panel stays as a fallback.
      const phone = matchMedia('(hover: none)').matches;
      setDraft(d);
      setTried(phone);
      setStatus('compose');
      if (phone) location.href = links(d).mailto;
      return;
    }
    const data = new FormData(form);
    data.set('beta', data.get('beta') ? 'yes' : 'no');
    data.set('ref', getRef());
    data.set('page', location.pathname);
    setStatus('sending');
    try {
      const res = await fetch(endpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
      if (res.status === 422) {
        // Formspree's answer to a field it won't take. For the email that means it isn't an address it can use.
        const body = (await res.json().catch(() => null)) as { errors?: { field?: string; code?: string }[] } | null;
        if (body?.errors?.some((x) => x.field === 'email' || /EMAIL/.test(x.code ?? ''))) {
          setStatus('idle');
          return flagEmail(EMAIL_INVALID);
        }
      }
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

  return (
    <div id="waitlist" className={`max-w-[34em] scroll-mt-32 ${className}`}>
      {status === 'compose' && draft && (
        <SendPanel
          draft={draft}
          tried={tried}
          onEdit={() => {
            setStatus('idle');
            requestAnimationFrame(() => emailRef.current?.focus());
          }}
        />
      )}
      <form
        ref={formRef}
        name="verge-waitlist"
        hidden={status === 'compose'}
        action={endpoint ?? `mailto:${to}?subject=${enc(SUBJECT)}`}
        method="POST"
        encType={endpoint ? undefined : 'text/plain'}
        onSubmit={onSubmit}
        onInput={() => {
          if (status === 'error') setStatus('idle');
          if (emailError) setEmailError(null);
        }}
        aria-label="Verge waitlist"
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
        <input
          ref={emailRef}
          id="waitlist-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? 'waitlist-email-error' : undefined}
          className={`${CONTROL} mt-8 min-h-[56px]`}
        />
        {emailError && (
          <p id="waitlist-email-error" className="mt-8 text-body font-medium text-danger">
            {emailError}
          </p>
        )}

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

        <div className="mt-24 flex flex-col gap-12 sm:flex-row">
          <button type="submit" disabled={status === 'sending'} className={`${PRIMARY_LG} sm:min-w-[224px]`}>
            {status === 'sending' ? 'Sending…' : 'Get early access'}
          </button>
          {beside}
        </div>

        {status === 'error' && (
          <p role="alert" className="mt-12 text-body font-medium text-danger">
            That didn’t go through. Try again in a moment, or email {to}.
          </p>
        )}
        <p className="mt-12 text-small text-muted">We’ll only email you about Verge.</p>
      </form>
    </div>
  );
}
