'use client';
import { useRef, useState } from 'react';
import { site } from '@/data/site';
import { getRef } from './RefTracker';
import { ArrowRight } from './Icons';

const needs = ['New site', 'Redesign', 'Not sure'];
// TODO(jakob): adjust budget bands once prices are set.
const budgets = ['Under $1k', '$1k–$2.5k', '$2.5k–$5k', '$5k+', 'Not sure yet'];

type Status = 'idle' | 'sending' | 'sent' | 'error';

function Chips({ name, legend, options, required }: { name: string; legend: string; options: string[]; required?: boolean }) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm text-bone">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o, i) => (
          <label key={o}>
            <input type="radio" name={name} value={o} required={required && i === 0} className="peer sr-only" />
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

/**
 * Quote request → Formspree. Works without JS too (plain POST to Formspree's hosted thank-you page).
 * With JS it submits in place and shows the success state.
 */
export function QuoteForm() {
  const [status, setStatus] = useState<Status>('idle');
  const done = useRef<HTMLDivElement>(null);
  const endpoint = site.formspreeId ? `https://formspree.io/f/${site.formspreeId}` : undefined;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    data.set('ref', getRef());
    data.set('page', location.pathname);
    if (!endpoint) {
      // TODO(jakob): remove once NEXT_PUBLIC_FORMSPREE_ID is set.
      console.warn('Quote form: NEXT_PUBLIC_FORMSPREE_ID is not set.');
      setStatus('error');
      return;
    }
    setStatus('sending');
    try {
      const res = await fetch(endpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(String(res.status));
      setStatus('sent');
      form.reset();
      requestAnimationFrame(() => done.current?.focus());
    } catch {
      setStatus('error');
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
    <form action={endpoint} method="POST" onSubmit={onSubmit} className="grid gap-6">
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
      <Chips name="budget" legend="Budget" options={budgets} required />
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
      <p role="alert" className="text-sm text-ember empty:hidden">
        {status === 'error' && (
          <>
            That didn&rsquo;t send. Email{' '}
            <a className="underline underline-offset-4" href={`mailto:${site.founder.email}`}>
              {site.founder.email}
            </a>{' '}
            and {site.founder.firstName} will take it from there.
          </>
        )}
      </p>
    </form>
  );
}
