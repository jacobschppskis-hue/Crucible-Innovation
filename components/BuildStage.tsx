'use client';
import { useEffect, useRef, useState } from 'react';
import { ease, seg, trackScroll } from '@/lib/scroll';
import { HeatField } from './HeatField';
import { ArrowRight } from './Icons';
import { LiveSite, type Theme } from './LiveSite';
import { WordReveal } from './WordReveal';
import './BuildStage.css';

const casts: { theme: Theme; type: string }[] = [
  { theme: 'cafe', type: 'Café' },
  { theme: 'barber', type: 'Barbershop' },
  { theme: 'landscaper', type: 'Landscaper' },
];

const captions = [
  {
    label: '01 · Every screen',
    title: 'Built for the phone in their pocket.',
    body: 'Mobile-first. Every layout is drawn for the phone first, then opened up for the big screen.',
  },
  {
    label: '02 · Every business',
    title: 'Not a template.',
    body: 'Same week, different business. Every concept here began as a blank page, not a template.',
  },
  {
    label: '03 · Live in about a week',
    title: 'Then it’s yours.',
    body: 'Your domain, your content, live in about a week. No payment until you’ve approved the design.',
  },
];

/** Where the pinned story runs; elsewhere (reduced motion, short screens, no JS) the page shows finished states. */
const PINNED = '(prefers-reduced-motion: no-preference) and (min-height: 560px)';
const BAND = 0.18; // the finished design trails the blueprint by this much of the screen

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * The /sites opening, one pinned scene around a live concept site (real HTML, not a screenshot):
 *  - On load the café is cast: its blueprint pours in from the top and the finished design follows behind an
 *    Ember heat front (CSS only).
 *  - First scroll: the hero copy gives way to three captions while the frame turns into a phone and the site
 *    reflows (01), the same frame is recast as two other businesses (02), and it settles (03).
 * Scroll writes inline styles straight onto the few elements that move, so nothing else restyles per frame.
 */
export function BuildStage() {
  const ref = useRef<HTMLElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const device = useRef<HTMLDivElement>(null);
  // The other two businesses are only needed once the scroll story can run, so they mount after hydration.
  const [more, setMore] = useState(false);

  useEffect(() => {
    if (!matchMedia(PINNED).matches) return;
    const id = (window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 600)))(() => setMore(true), { timeout: 1500 });
    return () => (window.cancelIdleCallback ?? clearTimeout)(id);
  }, []);

  useEffect(() => {
    if (!more) return;
    const el = ref.current!;
    const dev = device.current!;
    const q = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
    const hero = q('.bs-hero');
    const caps = [...el.querySelectorAll<HTMLElement>('.bs-cap')];
    const frame = q('.bs-frame');
    const bar = q('.bs-bar');
    const status = q('.bs-status');
    const type = q('.bs-type');
    const cast = [2, 3].map((n) => {
      const root = q(`.bs-c${n}`);
      const layer = (k: string) => [q(`.bs-c${n} .${k}`), q(`.bs-c${n} .${k} > .bs-in`)] as const;
      return { root, bp: layer('bs-bpl'), fin: layer('bs-fin'), track: q(`.bs-c${n} .bs-track`) };
    });
    const mq = matchMedia(PINNED);

    // Geometry: the desktop frame fills its slot; the phone is as tall as the stage allows. On phones the device
    // also rises to sit under the (shorter) captions.
    let g = { dw: 0, dh: 0, pw: 0, ph: 0, riseD: 0, riseP: 0 };
    const measure = () => {
      dev.style.width = dev.style.height = '';
      const s = slot.current!.getBoundingClientRect();
      const stage = (el.firstElementChild as HTMLElement).getBoundingClientRect();
      const desktop = innerWidth >= 1024;
      const capsBottom = Math.max(...caps.map((c) => c.getBoundingClientRect().bottom)) - stage.top;
      const top = capsBottom + 24;
      const avail = desktop ? Math.min(stage.height * 0.82, 700) : stage.height - top - 20;
      const ph = Math.max(300, Math.min(avail, 660));
      const center = s.top - stage.top + s.height / 2;
      // On phones the device rises to sit just under the captions, whichever shape it is in.
      const rise = (h: number) => (desktop ? 0 : Math.min(0, top + h / 2 - center));
      g = { dw: s.width, dh: s.height, pw: Math.min(ph / 2.05, s.width * 0.92), ph, riseD: rise(s.height), riseP: rise(ph) };
    };

    // A wipe made of two opposite translations (the layer slides down, its content slides up by the same amount),
    // so it is pure transform work and stays in step with the front.
    const wipe = ([outer, inner]: readonly [HTMLElement, HTMLElement], a: number) => {
      outer.style.transform = `translateY(${((a - 1) * 100).toFixed(2)}%)`;
      inner.style.transform = `translateY(${((1 - a) * 100).toFixed(2)}%)`;
    };
    const setCast = (c: (typeof cast)[number], w: number) => {
      c.root.hidden = w <= 0;
      if (w <= 0) return;
      const a = clamp01(w);
      wipe(c.bp, a);
      wipe(c.fin, clamp01(w - BAND));
      c.track.style.transform = `translateY(${(a * 100).toFixed(2)}%)`;
      c.track.style.opacity = String(clamp01(Math.min(w, 1.04 - w) * 25));
    };

    let layout = 'desktop';
    let last = 0;
    const update = (p: number) => {
      if (!mq.matches) return;
      const out = ease.inOut(seg(p, 0.02, 0.1));
      const m = ease.inOut(seg(p, 0.12, 0.27)) * (1 - ease.inOut(seg(p, 0.55, 0.69)));
      hero.style.opacity = String(1 - out * 1.4);
      hero.style.transform = `translateX(${(-out * 48).toFixed(1)}px)`;
      el.toggleAttribute('data-out', out > 0.5);
      const shown = [seg(p, 0.09, 0.14) * (1 - seg(p, 0.31, 0.35)), seg(p, 0.35, 0.4) * (1 - seg(p, 0.66, 0.7)), seg(p, 0.7, 0.75)];
      caps.forEach((cap, i) => {
        cap.style.opacity = String(shown[i]);
        cap.style.transform = `translateY(${((1 - shown[i]) * 24).toFixed(1)}px)`;
        cap.style.visibility = shown[i] > 0.02 ? 'visible' : 'hidden';
      });
      dev.style.width = `${(g.dw + (g.pw - g.dw) * m).toFixed(1)}px`;
      dev.style.height = `${(g.dh + (g.ph - g.dh) * m).toFixed(1)}px`;
      dev.style.translate = `-50% calc(-50% + ${((g.riseD + (g.riseP - g.riseD) * m) * out).toFixed(1)}px)`;
      frame.style.borderRadius = `${(16 + m * 28).toFixed(1)}px`;
      bar.style.opacity = String(clamp01(1 - m * 2));
      status.style.opacity = String(clamp01(m * 2 - 1));
      type.style.opacity = String(clamp01(1 - m * 3));
      const next = m > 0.5 ? 'phone' : 'desktop';
      if (next !== layout) dev.dataset.layout = layout = next;
      setCast(cast[0], seg(p, 0.36, 0.5) * 1.2);
      setCast(cast[1], seg(p, 0.72, 0.86) * 1.2);
      el.dataset.theme = casts[p >= 0.79 ? 2 : p >= 0.43 ? 1 : 0].theme;
    };
    const reset = () => {
      for (const n of [hero, ...caps, dev, frame, bar, status, type]) n.removeAttribute('style');
      cast.forEach((c) => (c.root.hidden = true));
      dev.dataset.layout = layout = 'desktop';
      el.dataset.theme = 'cafe';
      el.removeAttribute('data-out');
    };

    measure();
    const off = trackScroll(el, 'pin', (p) => update((last = p)));
    const onResize = () => {
      if (!mq.matches) return reset();
      measure();
      update(last);
    };
    addEventListener('resize', onResize);
    mq.addEventListener('change', onResize);
    document.fonts?.ready.then(onResize); // caption heights change once the web fonts arrive
    return () => {
      off();
      removeEventListener('resize', onResize);
      mq.removeEventListener('change', onResize);
    };
  }, [more]);

  // Cursor tilt on the device, max 5°. Mouse only, motion-safe.
  useEffect(() => {
    if (!matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)').matches) return;
    const el = device.current!;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) return;
        const dx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (innerWidth / 2)));
        const dy = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (innerHeight / 2)));
        el.style.setProperty('--ry', `${(dx * 5).toFixed(2)}deg`);
        el.style.setProperty('--rx', `${(-dy * 5).toFixed(2)}deg`);
      });
    };
    addEventListener('pointermove', onMove, { passive: true });
    return () => {
      removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section ref={ref} aria-label="Crucible Sites" className="bs relative" data-theme="cafe">
      <div className="bs-stage relative overflow-hidden">
        <HeatField origin={[0.76, 0.52]} originMobile={[0.5, 0.78]} />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-ground" />
        <div className="container-x relative grid items-center gap-12 pt-[calc(var(--nav-h)+2.5rem)] pb-16 lg:min-h-[100svh] lg:grid-cols-[1fr_1.08fr] lg:gap-16 lg:pt-[var(--nav-h)] lg:pb-0">
          <div className="bs-copywrap grid">
            <div className="bs-hero">
              <p className="label">Crucible Sites · Websites for local businesses</p>
              <WordReveal
                as="h1"
                immediate
                className="h-display mt-6 text-[2.625rem] sm:text-6xl xl:text-[4.5rem]"
                segments={[{ t: 'Your business deserves a website that' }, { t: 'actually looks good.', className: 'accent molten text-[1.08em]' }]}
              />
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-bone-dim sm:text-xl">
                We design and build fast, beautiful websites for local businesses. Live in about a week.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <a href="#start" className="btn btn-primary">
                  Get a quote <ArrowRight />
                </a>
                <a href="#work" className="btn btn-ghost">
                  See our work
                </a>
              </div>
            </div>
            <ol className="bs-caps">
              {captions.map((c, i) => (
                <li key={c.label} className={`bs-cap bs-cap-${i + 1}`}>
                  <p className="label">{c.label}</p>
                  <h2 className="h-section mt-4">{c.title}</h2>
                  <p className="mt-5 max-w-md text-lg leading-relaxed text-bone-dim">{c.body}</p>
                </li>
              ))}
            </ol>
          </div>

          <div ref={slot} className="bs-slot relative">
            <div className="bs-tilt">
              <div ref={device} className="bs-device" data-layout="desktop">
                <div aria-hidden className="bs-glow" />
                <figure
                  role="img"
                  aria-label="A concept website for a fictional café, built live in HTML. Scrolling turns it into a phone layout and recasts it as a barbershop and a landscaper."
                  className="bs-frame"
                >
                  <div aria-hidden className="bs-chrome">
                    <div className="bs-bar">
                      <span className="bs-dots">
                        <i />
                        <i />
                        <i />
                      </span>
                      <span className="bs-url">yourbusiness.com</span>
                      <span className="bs-concept">Concept</span>
                    </div>
                    <div className="bs-status">
                      <span>9:41</span>
                      <span className="bs-notch" />
                      <span className="bs-concept">Concept</span>
                    </div>
                  </div>
                  <div aria-hidden className="bs-screen ls-vp">
                    {casts.map((c, i) =>
                      i === 0 || more ? (
                        <div key={c.theme} className={`bs-cast bs-c${i + 1}`} hidden={i > 0}>
                          <div className="bs-layer bs-bpl">
                            <div className="bs-in">
                              <LiveSite theme={c.theme} blueprint />
                            </div>
                          </div>
                          <div className="bs-layer bs-fin">
                            <div className="bs-in">
                              <LiveSite theme={c.theme} />
                            </div>
                          </div>
                          <div className="bs-track">
                            <div className="bs-band" />
                            <div className="bs-front" />
                          </div>
                        </div>
                      ) : null,
                    )}
                  </div>
                </figure>
                <p className="bs-type label">
                  Concept ·{' '}
                  {casts.map((c) => (
                    <span key={c.theme} className={`bs-type-${c.theme}`}>
                      {c.type}
                    </span>
                  ))}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
