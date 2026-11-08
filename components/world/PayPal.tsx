import { paypal } from '@/data/home';

/**
 * PayPal -> six sparks across the planet -> six companies, told step by step. Skeleton by `world`; `paypal` owns it
 * (scene in lib/world/paypal.ts, reading frame.at('paypal')). Captions are facts from Jacob's paragraph 2 only.
 */
export function PayPal() {
  return (
    <section data-place="paypal" aria-labelledby="pp-h" className="w-place w-paypal">
      <div className="w-sticky">
        <div className="container-x pt-28">
          <h2 id="pp-h" className="h-section max-w-[14ch]">
            {paypal.heading}
          </h2>
          <ol className="w-pp-steps mt-8 max-w-md space-y-3 text-lg text-bone-dim">
            {paypal.steps.map((s) => (
              <li key={s} data-pp-step>
                {s}
              </li>
            ))}
          </ol>
          <ul aria-label="Companies founded by PayPal's people" className="w-pp-names">
            {paypal.companies.map((c) => (
              <li key={c} data-pp-name>
                {c}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
