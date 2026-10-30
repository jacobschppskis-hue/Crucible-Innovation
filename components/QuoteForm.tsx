'use client';
import { useEffect, useRef, useState } from 'react';
import { packages } from '@/data/pricing';
import { site } from '@/data/site';
import { getRef } from './RefTracker';
import { ArrowRight, Check } from './Icons';

const needs = ['New site', 'Redesign', 'Not sure'];
const packageOptions = [...packages.map((p) => p.name), 'Not sure yet'];
export const PACKAGE_EVENT = 'crucible:package';

type Draft = { subject: string; body: string };
type Status = 'idle' | 'sending' | 'sent' | 'compose' | 'error';

const to = site.founder.email;
const enc = encodeURIComponent;
// Keep generated links comfortably inside what mail apps and browsers accept.
const fit = (s: string, max = 1600) => (s.length > max ? `${s.slice(0, max)}…` : s);

function compose(form: HTMLFormElement): Draft {
  const f = new FormData(form);
  const v = (k: string) => String(f.get(k) ?? '').trim();
  const pkg = v('package') || 'Not sure yet';
  const lines = [
    `Hi ${site.founder.firstName},`,
    '',
    'I’d like a quote for a website.',
    '',
    `Name: ${v('name')}`,
    `Business: ${v('business')}`,
    `Email: ${v('email')}`,
    v('phone') ? `Phone: ${v('phone')}` : null,
    v('website') ? `Current website: ${v('website')}` : null,
    `Looking for: ${v('need') || 'Not sure'}`,
    `Package: ${v('package') || 'Not sure yet'}`,
    '',
    'About the business:',
    fit(v('message')),
    '',
    `Sent from crucibleinnovation.com/sites${getRef() ? ` · ref: ${getRef()}` : ''}`,
  ].filter((l): l is string => l !== null);
  return { subject: `Quote request: ${pkg} · ${v('business')}`, body: lines.join('\n') };
}

const links = ({ subject, body }: Draft) => ({
  mailto: `mailto:${to}?subject=${enc(subject)}&body=${enc(body)}`,
  gmail: `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(to)}&su=${enc(subject)}&body=${enc(body)}`,
  outlook: `https://outlook.live.com/mail/0/deeplink/compose?to=${enc(to)}&subject=${enc(subject)}&body=${enc(body)}`,
});

function Chips({ name, legend, options, value, onChange, required }: { name: string; legend: string; options: string[]; value?: string; onChange?: (v: string) => void; required?: boolean }) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm text-bone">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o, i) => (
          <label key={o}>
            <input
              type="radio"
              name={name}
              value={o}
              required={required && i === 0}
              className="peer sr-only"
              {...(onChange ? { checked: value === o, onChange: () => onChange(o) } : {})}
            />
            <span className="chip">{o}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Field({ label, optional, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; optional?: boolean }) {
  return (
    <label className="block">
      <span className="mb-2 flex justify-between text-sm text-bone">
        {label}
        {optional && <span className="text-bone-dim">Optional</span>}
      </span>
      <input className="field" required={!optional} {...props} />
    </label>
  );
}

function SendPanel({ draft, onEdit }: { draft: Draft; onEdit: () => void }) {
  const [opened, setOpened] = useState(false);
  const [copied, setCopied] = useState(false);
  const l = links(draft);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`To: ${to}\nSubject: ${draft.subject}\n\n${draft.body}`);
      setCopied(true);
      setOpened(true);
    } catch {
      setCopied(false);
    }
  };

  const option = 'btn w-full';
  return (
    <div className="send-panel flex min-h-[28rem] flex-col justify-center">
      <div className="flex items-center gap-3">
        <span aria-hidden className={`size-2.5 rounded-full bg-ember ${opened ? 'pulse-dot' : ''}`} />
        <p className="label">{opened ? 'Almost there' : 'Your request is ready'}</p>
      </div>
      <h3 ref={heading} tabIndex={-1} className="mt-4 font-display text-3xl font-semibold tracking-[-0.02em] outline-none">
        {opened ? 'Hit send in the window that opened.' : 'Send it your way.'}
      </h3>
      <p className="mt-3 max-w-md text-bone-dim" aria-live="polite">
        {opened
          ? `${site.founder.firstName} will reply within 24 hours. Nothing opened? Try another option below.`
          : `It’s written and addressed to ${site.founder.firstName}. Pick where to send it from.`}
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <a href={l.mailto} onClick={() => setOpened(true)} className={`${option} btn-primary`}>
          Mail app <ArrowRight />
        </a>
        <a href={l.gmail} target="_blank" rel="noopener" onClick={() => setOpened(true)} className={`${option} btn-ghost`}>
          Gmail <ArrowRight />
        </a>
        <a href={l.outlook} target="_blank" rel="noopener" onClick={() => setOpened(true)} className={`${option} btn-ghost`}>
          Outlook <ArrowRight />
        </a>
        <button type="button" onClick={copy} className={`${option} btn-ghost`}>
          {copied ? 'Copied' : 'Copy message'} {copied ? <Check /> : <span aria-hidden>⧉</span>}
        </button>
      </div>
      <p className="mt-6 text-sm text-bone-dim">
        Or email{' '}
        <a className="text-bone underline underline-offset-4" href={`mailto:${to}`}>
          {to}
        </a>{' '}
        directly.{' '}
        <button type="button" onClick={onEdit} className="text-bone underline underline-offset-4">
          Edit request
        </button>
      </p>
    </div>
  );
}

/**
 * Quote request. With a Formspree ID it posts in place; otherwise it writes the email for the visitor
 * (subject, body, all their answers) and opens it in their mail app, Gmail or Outlook. On phones the
 * mail app opens straight away. Without JS the form still opens a mail app (mailto action).
 */
export function QuoteForm() {
  const [status, setStatus] = useState<Status>('idle');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pkg, setPkg] = useState<string | undefined>();
  const formRef = useRef<HTMLFormElement>(null);
  const done = useRef<HTMLDivElement>(null);
  const endpoint = site.formspreeId ? `https://formspree.io/f/${site.formspreeId}` : undefined;

  // "Get a quote" on a pricing card pre-selects that package.
  useEffect(() => {
    const onPick = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      const p = packages.find((x) => x.id === id);
      if (p) setPkg(p.name);
    };
    addEventListener(PACKAGE_EVENT, onPick);
    return () => removeEventListener(PACKAGE_EVENT, onPick);
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!endpoint) {
      const d = compose(form);
      setDraft(d);
      setStatus('compose');
      // Phones almost always have a mail app: open it immediately, keep the panel as a fallback.
      if (matchMedia('(hover: none)').matches) location.href = links(d).mailto;
      return;
    }
    const data = new FormData(form);
    data.set('ref', getRef());
    data.set('page', location.pathname);
    setStatus('sending');
    try {
      const res = await fetch(endpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(String(res.status));
      setStatus('sent');
      form.reset();
      requestAnimationFrame(() => done.current?.focus());
    } catch {
      setDraft(compose(form));
      setStatus('compose'); // fall back to the email route rather than a dead end
    }
  }

  if (status === 'sent') {
    return (
      <div ref={done} tabIndex={-1} role="status" className="flex min-h-[28rem] flex-col items-center justify-center gap-6 text-center outline-none">
        <span aria-hidden className="pulse-dot size-3 rounded-full bg-ember" />
        <div>
          <p className="font-display text-3xl font-semibold tracking-[-0.02em]">Got it.</p>
          <p className="mt-2 text-bone-dim">{site.founder.firstName} will reply within 24 hours.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {status === 'compose' && draft && <SendPanel draft={draft} onEdit={() => setStatus('idle')} />}
      <form
        ref={formRef}
        hidden={status === 'compose'}
        action={endpoint ?? `mailto:${to}?subject=${enc('Quote request')}`}
        method="POST"
        encType={endpoint ? undefined : 'text/plain'}
        onSubmit={onSubmit}
        className="grid gap-6"
      >
        <input type="hidden" name="_subject" defaultValue="New Crucible Sites quote request" />
        <input type="hidden" name="ref" defaultValue="" />
        {/* Honeypot: humans never see or fill this. */}
        <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label>
            Leave this empty
            <input type="text" name="_gotcha" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Your name" name="name" autoComplete="name" />
          <Field label="Business name" name="business" autoComplete="organization" />
          <Field label="Email" name="email" type="email" autoComplete="email" />
          <Field label="Phone" name="phone" type="tel" autoComplete="tel" optional />
        </div>
        <Field label="Current website" name="website" type="text" inputMode="url" placeholder="yourbusiness.com" optional />
        <Chips name="need" legend="What do you need?" options={needs} required />
        <Chips name="package" legend="Which package?" options={packageOptions} value={pkg} onChange={setPkg} required />
        <label className="block">
          <span className="mb-2 block text-sm text-bone">Tell us about your business</span>
          <textarea className="field" name="message" required rows={5} placeholder="What you do, who your customers are, anything you love or hate about your current site." />
        </label>

        <div className="flex flex-col-reverse items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-sm text-sm text-bone-dim">Pricing is confirmed in your quote. No payment until you&rsquo;ve approved the design.</p>
          <button type="submit" disabled={status === 'sending'} className="btn btn-primary w-full sm:w-auto disabled:opacity-70">
            {status === 'sending' ? 'Sending…' : 'Request a quote'}
            <ArrowRight />
          </button>
        </div>
      </form>
    </div>
  );
}
