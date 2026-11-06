'use client';
import { useId, useState } from 'react';
import { ArrowRight } from './Icons';
import { LiveSite, type Theme } from './LiveSite';
import './TryIt.css';

const trades: { theme: Theme; label: string }[] = [
  { theme: 'cafe', label: 'Café' },
  { theme: 'barber', label: 'Barbershop' },
  { theme: 'landscaper', label: 'Landscaper' },
];

const toDomain = (name: string) => {
  const d = name
    .toLowerCase()
    .replace(/&/g, 'and')
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 28);
  return d ? `${d}.com` : 'yourbusiness.com';
};

/**
 * "Try it with your business": the visitor types their business name and picks the closest trade, and the live
 * concept site is recast with their name, on a desktop and a phone. Everything stays in the browser; nothing is sent.
 * Without JS the concept simply shows with its own name.
 */
export function TryIt() {
  const [name, setName] = useState('');
  const [theme, setTheme] = useState<Theme>('barber');
  const [cast, setCast] = useState(0);
  const id = useId();
  const brand = name.trim().slice(0, 32);
  const domain = toDomain(brand);
  const pick = (t: Theme) => {
    if (t === theme) return;
    setTheme(t);
    setCast((n) => n + 1);
  };

  return (
    <section id="try" aria-labelledby={`${id}-h`} className="try container-x cv-auto" style={{ '--h-sm': '1500px', '--h-lg': '900px' } as React.CSSProperties}>
      <div className="try-controls">
        <h2 id={`${id}-h`} className="h-section try-h max-w-[10ch]">
          Try it with your business
        </h2>
        <p className="mt-6 max-w-sm text-lg leading-relaxed text-bone-dim">Type your business name and pick the closest trade. It stays in your browser.</p>

        <label htmlFor={`${id}-name`} className="mt-10 block font-medium">
          Business name
        </label>
        <input
          id={`${id}-name`}
          className="try-input"
          type="text"
          autoComplete="organization"
          maxLength={32}
          placeholder="Sharp & Co."
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <fieldset className="mt-8">
          <legend className="font-medium">Trade</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {trades.map((t) => (
              <label key={t.theme} className="try-chip">
                <input type="radio" name={`${id}-trade`} value={t.theme} checked={theme === t.theme} onChange={() => pick(t.theme)} className="sr-only" />
                <span>{t.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <a href="#start" className="btn btn-primary mt-10">
          Get one made for you <ArrowRight />
        </a>
      </div>

      <div className="try-stage" data-pull="12">
        <figure className="try-desk" aria-label={`Concept website for ${brand || 'a fictional business'}, ${trades.find((t) => t.theme === theme)!.label.toLowerCase()} design, on a laptop.`}>
          <div aria-hidden className="try-bar">
            <span className="try-dots">
              <i />
              <i />
              <i />
            </span>
            <span className="try-url">{domain}</span>
          </div>
          <div aria-hidden key={`d${cast}`} className={`try-screen ls-vp ${cast ? "try-cast" : ""}`}>
            <LiveSite theme={theme} brand={brand} />
            <span className="try-front" />
          </div>
        </figure>
        <figure className="try-phone" data-layout="phone" aria-label="The same concept site on a phone.">
          <div aria-hidden key={`p${cast}`} className={`try-screen ls-vp ${cast ? "try-cast" : ""}`}>
            <LiveSite theme={theme} brand={brand} />
            <span className="try-front" />
          </div>
        </figure>
        <p className="label try-cap">Concept. Yours is designed for your business from a blank page.</p>
      </div>
    </section>
  );
}
