import { paypal } from '@/data/home';
import './PayPal.css';

/**
 * PayPal -> six companies, told step by step. Static markup only: the scene and everything that moves (each caption's
 * opacity, the names riding their places on the planet) is lib/world/paypal.ts, which marks the section `data-live`
 * when the world runs. Without it (no JS, no WebGL, reduced motion before the world starts) every step reads in order
 * as plain text. Captions are facts from Jacob's paragraph 2 only (data/home.ts). Nothing behind any of the text.
 */
export function PayPal() {
  return (
    <section data-place="paypal" aria-labelledby="pp-h" className="w-place w-paypal">
      <div className="w-sticky">
        <div className="w-pp-caps container-x">
          {paypal.steps.map((s, i) =>
            s === null ? (
              <h2 key={i} id="pp-h" data-pp-step className="w-pp-step w-pp-big h-section wide">
                {paypal.heading}
              </h2>
            ) : (
              <p key={i} data-pp-step className="w-pp-step">
                {s}
              </p>
            ),
          )}
        </div>
        <ul aria-hidden className="w-pp-names">
          {['PayPal', ...paypal.companies].map((c, i) => (
            <li key={c} data-pp-name className={i ? undefined : 'w-pp-root'}>
              {c}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
