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

/** The questions, in order; the review comes after the last one. Without JS they're simply the form's labels. */
const questions = [
  'What’s your name?',
  'What’s the business called?',
  'Where should we reply?',
  'Do you have a website now?',
  'What do you need?',
  'Which package?',
  'What should we know about the business?',
];
const REVIEW = questions.length;
const SITE_STEP = 3;
const MESSAGE_STEP = 6;

/** Calm, specific notes for a missing or malformed answer, checked before moving on. */
const messages: Record<string, { missing: string; invalid?: string }> = {
  name: { missing: 'We need a name to reply to' },
  business: { missing: 'Add the business name to carry on' },
  email: { missing: 'Add an email so we can send your quote', invalid: 'That email doesn’t look quite right' },
  need: { missing: 'Pick one. Not sure is a fine answer' },
  package: { missing: 'Pick one. Not sure yet is a fine answer' },
  message: { missing: 'A sentence or two is plenty' },
};

/** What the review lists: label, field, and the question that asks for it. Empty optional answers are left out. */
const summary: [label: string, field: string, step: number][] = [
  ['Name', 'name', 0],
  ['Business', 'business', 1],
  ['Email', 'email', 2],
  ['Phone', 'phone', 2],
  ['Website', 'website', 3],
  ['Looking for', 'need', 4],
  ['Package', 'package', 5],
  ['About', 'message', 6],
];

type Problem = { name: string; msg: string; el: HTMLElement };

/** The first unanswered or malformed field inside `root` (one question), or null. */
function check(root: HTMLElement | null | undefined, only?: Element): Problem | null {
  if (!root) return null;
  for (const f of root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')) {
    if (only && f !== only) continue;
    const radio = f.type === 'radio';
    const empty = radio ? !root.querySelector(`[name="${f.name}"]:checked`) : !f.value.trim();
    const needed = radio ? !!root.querySelector(`[name="${f.name}"][required]`) : f.required;
    const m = messages[f.name];
    if (needed && empty) return { name: f.name, msg: m?.missing ?? 'This one’s needed', el: f };
    if (!empty && !f.checkValidity()) return { name: f.name, msg: m?.invalid ?? 'That doesn’t look quite right', el: f };
  }
  return null;
}

function Chips({ name, options, value, onChange, required, invalid, describedBy }: { name: string; options: string[]; value?: string; onChange?: (v: string) => void; required?: boolean; invalid?: boolean; describedBy?: string }) {
  return (
    <div className="qf-chips">
      {options.map((o, i) => (
        <label key={o}>
          <input
            type="radio"
            name={name}
            value={o}
            required={required && i === 0}
            className="sr-only"
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            {...(onChange ? { checked: value === o, onChange: () => onChange(o) } : {})}
          />
          <span className="qf-chip">{o}</span>
        </label>
      ))}
    </div>
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

  return (
    <div className="qf-panel">
      <p className="qf-status">
        <span aria-hidden className={`size-2 rounded-full bg-ember ${opened ? 'pulse-dot' : ''}`} />
        {opened ? 'Almost there' : 'Your request is ready'}
      </p>
      <h3 ref={heading} tabIndex={-1} className="qf-q">
        {opened ? 'Hit send in the window that opened' : 'Send it your way'}
      </h3>
      <p className="qf-lede" aria-live="polite">
        {opened
          ? `${site.founder.firstName} will reply within 24 hours. Nothing opened? Try another option below.`
          : `It’s written and addressed to ${site.founder.firstName}. Pick where to send it from.`}
      </p>

      <div className="qf-routes">
        <a href={l.mailto} onClick={() => setOpened(true)} className="btn btn-primary">
          Mail app <ArrowRight />
        </a>
        <a href={l.gmail} target="_blank" rel="noopener" onClick={() => setOpened(true)} className="btn btn-ghost">
          Gmail <ArrowRight />
        </a>
        <a href={l.outlook} target="_blank" rel="noopener" onClick={() => setOpened(true)} className="btn btn-ghost">
          Outlook <ArrowRight />
        </a>
        <button type="button" onClick={copy} className="btn btn-ghost">
          {copied ? 'Copied' : 'Copy message'} {copied && <Check />}
        </button>
      </div>
      <p className="qf-aside">
        Or email <a href={`mailto:${to}`}>{to}</a> directly.{' '}
        <button type="button" onClick={onEdit}>
          Edit request
        </button>
      </p>
    </div>
  );
}

/**
 * Quote request, one question at a time. With a Formspree ID it posts in place; otherwise it writes the email for the
 * visitor (subject, body, all their answers) and opens it in their mail app, Gmail or Outlook. On phones the mail app
 * opens straight away.
 *
 * It's one ordinary <form> throughout: with JS, CSS shows only the current question (html.js) and the answers are
 * checked as they're given; without JS every field is visible and the form opens a mail app (mailto action).
 */
export function QuoteForm() {
  const [status, setStatus] = useState<Status>('idle');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pkg, setPkg] = useState<string | undefined>();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<'fwd' | 'back'>();
  const [leaving, setLeaving] = useState<number | null>(null);
  const [error, setError] = useState<(Problem & { step: number }) | null>(null);
  const [announce, setAnnounce] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [hasSite, setHasSite] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const done = useRef<HTMLDivElement>(null);
  const reviewHead = useRef<HTMLHeadingElement>(null);
  const stepEls = useRef<(HTMLDivElement | null)[]>([]);
  const moved = useRef(false); // focus follows the questions only once the visitor has moved
  const editing = useRef(false); // came from the review to change one answer: go straight back after it
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

  // With JS each answer is checked as it's given (calm inline notes), so the browser's own bubbles stay out of it.
  // Without JS the form keeps native validation.
  useEffect(() => {
    if (formRef.current) formRef.current.noValidate = true;
  }, []);

  // The outgoing question has finished leaving.
  useEffect(() => {
    if (leaving === null) return;
    const t = setTimeout(() => setLeaving(null), 420);
    return () => clearTimeout(t);
  }, [leaving]);

  // Focus moves to each new question's input, and the question is kept in view (steps differ in height, and on
  // phones the keyboard takes half the screen).
  useEffect(() => {
    if (!moved.current) return;
    const root = stepEls.current[step];
    const target = step === REVIEW ? reviewHead.current : (root?.querySelector<HTMLElement>('input:checked') ?? root?.querySelector<HTMLElement>('input, textarea'));
    target?.focus({ preventScroll: true });
    const form = formRef.current;
    if (!form) return;
    const top = form.getBoundingClientRect().top;
    const room = window.visualViewport?.height ?? innerHeight;
    if (top < 72 || top > room * 0.45) {
      const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
      scrollTo({ top: scrollY + top - 96, behavior: still ? 'auto' : 'smooth' });
    }
  }, [step]);

  function go(next: number) {
    if (next === step) return;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (next === REVIEW && formRef.current) {
      setAnswers(Object.fromEntries([...new FormData(formRef.current)].map(([k, v]) => [k, String(v).trim()])));
      editing.current = false;
    }
    moved.current = true;
    setDir(next > step ? 'fwd' : 'back');
    setLeaving(still ? null : step);
    setError(null);
    setStep(next);
    setAnnounce(next === REVIEW ? 'Review your request' : `Question ${next + 1} of ${questions.length}`);
  }

  function flag(p: Problem, at: number) {
    setError({ ...p, step: at });
    setAnnounce(p.msg);
    p.el.focus({ preventScroll: true });
  }

  function advance() {
    const p = check(stepEls.current[step]);
    if (p) return flag(p, step);
    go(editing.current ? REVIEW : step + 1);
  }

  function change(at: number) {
    editing.current = true;
    go(at);
  }

  // Enter advances (a textarea keeps Enter for new lines; Ctrl/⌘ + Enter advances from there). In a question with two
  // boxes (email, then phone), Enter goes to the next box first.
  function onKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    const t = e.target as HTMLElement;
    if (t.closest('button, a')) return;
    if (t instanceof HTMLTextAreaElement && !(e.metaKey || e.ctrlKey)) return;
    e.preventDefault();
    if (step === REVIEW) return formRef.current?.requestSubmit();
    if (t instanceof HTMLInputElement && t.type !== 'radio') {
      const boxes = [...(stepEls.current[step]?.querySelectorAll<HTMLInputElement>('input:not([type=radio])') ?? [])];
      const after = boxes[boxes.indexOf(t) + 1];
      if (after && !after.value) {
        const p = check(stepEls.current[step], t);
        return p ? flag(p, step) : after.focus();
      }
    }
    advance();
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    // Each answer was checked on the way; this only catches a request sent before every question was reached.
    for (let i = 0; i < REVIEW; i++) {
      const p = check(stepEls.current[i]);
      if (p) {
        go(i);
        setError({ ...p, step: i });
        setAnnounce(p.msg);
        return;
      }
    }
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
      <div ref={done} tabIndex={-1} role="status" className="qf-done outline-none">
        <p className="qf-q">Got it</p>
        <p className="qf-lede">{site.founder.firstName} will reply within 24 hours.</p>
      </div>
    );
  }

  const bad = (name: string) => (error?.name === name ? true : undefined);
  const msg = (i: number) => (
    <p id={`qf-msg-${i}`} className="qf-msg">
      {error?.step === i ? error.msg : null}
    </p>
  );
  const stepProps = (i: number) => ({
    ref: (el: HTMLDivElement | null) => {
      stepEls.current[i] = el;
    },
    className: 'qf-step',
    'data-active': i === step ? '' : undefined,
    'data-leaving': i === leaving && i !== step ? '' : undefined,
    'data-dir': dir,
    inert: (i === leaving && i !== step) || undefined,
  });
  const chosen = packages.find((p) => p.name === pkg);
  const nextLabel = step === SITE_STEP && !hasSite ? 'Skip' : step === MESSAGE_STEP ? 'Review' : 'Next';

  return (
    <div className="qf">
      {status === 'compose' && draft && (
        <SendPanel
          draft={draft}
          onEdit={() => {
            setStatus('idle');
            requestAnimationFrame(() => reviewHead.current?.focus());
          }}
        />
      )}
      <form
        ref={formRef}
        hidden={status === 'compose'}
        action={endpoint ?? `mailto:${to}?subject=${enc('Quote request')}`}
        method="POST"
        encType={endpoint ? undefined : 'text/plain'}
        onSubmit={onSubmit}
        onKeyDown={onKeyDown}
        onInput={() => error && setError(null)}
        aria-label="Quote request"
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

        {/* Progress: how far the metal has run (settled bone behind a hot front), Back, and where you are. */}
        <div className="qf-js">
          <div className="qf-bar" aria-hidden>
            <i style={{ '--qf-p': (step + 1) / (REVIEW + 1) } as React.CSSProperties} />
          </div>
          <div className="qf-meta">
            {step > 0 && (
              <button type="button" className="qf-back" onClick={() => go(step - 1)}>
                <ArrowRight className="size-4 rotate-180" /> Back
              </button>
            )}
            <p className="qf-count">{step < REVIEW ? `${step + 1} of ${questions.length}` : 'Review'}</p>
          </div>
        </div>
        <p className="sr-only" aria-live="polite">
          {announce}
        </p>

        <div className="qf-steps">
          <div {...stepProps(0)}>
            <label htmlFor="qf-name" className="qf-q">
              {questions[0]}
            </label>
            <input id="qf-name" name="name" className="qf-input" required autoComplete="name" autoCapitalize="words" enterKeyHint="next" aria-invalid={bad('name')} aria-describedby="qf-msg-0" />
            {msg(0)}
          </div>

          <div {...stepProps(1)}>
            <label htmlFor="qf-business" className="qf-q">
              {questions[1]}
            </label>
            <input id="qf-business" name="business" className="qf-input" required autoComplete="organization" autoCapitalize="words" enterKeyHint="next" aria-invalid={bad('business')} aria-describedby="qf-msg-1" />
            {msg(1)}
          </div>

          <div {...stepProps(2)}>
            <fieldset>
              <legend className="qf-q">{questions[2]}</legend>
              <label className="qf-field">
                <span className="qf-sub">Email</span>
                <input name="email" type="email" className="qf-input" required autoComplete="email" enterKeyHint="next" aria-invalid={bad('email')} aria-describedby="qf-msg-2" />
              </label>
              <label className="qf-field">
                <span className="qf-sub">
                  Phone <span>Optional</span>
                </span>
                <input name="phone" type="tel" className="qf-input" autoComplete="tel" enterKeyHint="next" />
              </label>
            </fieldset>
            {msg(2)}
          </div>

          <div {...stepProps(SITE_STEP)}>
            <label htmlFor="qf-website" className="qf-q">
              {questions[SITE_STEP]}
            </label>
            <input
              id="qf-website"
              name="website"
              type="text"
              inputMode="url"
              autoComplete="url"
              placeholder="yourbusiness.com"
              enterKeyHint="next"
              className="qf-input"
              aria-describedby="qf-hint-site"
              onChange={(e) => setHasSite(!!e.target.value.trim())}
            />
            <p id="qf-hint-site" className="qf-hint">
              Optional
            </p>
          </div>

          <div {...stepProps(4)}>
            <fieldset>
              <legend className="qf-q">{questions[4]}</legend>
              <Chips name="need" options={needs} required invalid={bad('need')} describedBy="qf-msg-4" />
            </fieldset>
            {msg(4)}
          </div>

          <div {...stepProps(5)}>
            <fieldset>
              <legend className="qf-q">{questions[5]}</legend>
              <Chips name="package" options={packageOptions} value={pkg} onChange={setPkg} required invalid={bad('package')} describedBy="qf-hint-pkg qf-msg-5" />
            </fieldset>
            <p id="qf-hint-pkg" className="qf-hint">
              {chosen ? chosen.summary : 'Not sure? We’ll suggest one.'}
            </p>
            {msg(5)}
          </div>

          <div {...stepProps(MESSAGE_STEP)}>
            <label htmlFor="qf-message" className="qf-q">
              {questions[MESSAGE_STEP]}
            </label>
            <p id="qf-hint-msg" className="qf-hint qf-hint-lead">
              What you do, who your customers are, and anything you love or hate about your current site
            </p>
            <textarea id="qf-message" className="qf-area" name="message" required rows={5} aria-invalid={bad('message')} aria-describedby="qf-hint-msg qf-msg-6" />
            {msg(MESSAGE_STEP)}
          </div>

          <div {...stepProps(REVIEW)}>
            <div className="qf-js">
              <h3 ref={reviewHead} tabIndex={-1} className="qf-q outline-none">
                Does this look right?
              </h3>
              <dl className="qf-review">
                {summary
                  .filter(([, k]) => answers[k] || (k !== 'phone' && k !== 'website'))
                  .map(([label, k, at]) => (
                    <div key={k} className="qf-row">
                      <dt>{label}</dt>
                      <dd className="qf-answer">{answers[k]}</dd>
                      <dd>
                        <button type="button" className="qf-change" onClick={() => change(at)} aria-label={`Change ${label.toLowerCase()}`}>
                          Change
                        </button>
                      </dd>
                    </div>
                  ))}
              </dl>
            </div>
            <p className="qf-note">No payment until you&rsquo;ve approved the design.</p>
          </div>
        </div>

        <div className="qf-foot">
          <button type="button" onClick={advance} className={`qf-js btn btn-primary ${step === REVIEW ? 'qf-off' : ''}`}>
            {nextLabel} <ArrowRight />
          </button>
          <button type="submit" disabled={status === 'sending'} className={`qf-send btn btn-primary ${step === REVIEW ? '' : 'qf-off'}`}>
            {status === 'sending' ? 'Sending…' : 'Request a quote'}
            <ArrowRight />
          </button>
          {step !== MESSAGE_STEP && (
            <span aria-hidden className="qf-js qf-enter">
              or press Enter
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
