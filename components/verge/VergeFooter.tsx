const LINK = 'underline decoration-1 underline-offset-4 hover:decoration-2';

/**
 * Verge's footer: its health disclaimer, then the mark with Sign in (to the waitlist, before launch). Where the app lists
 * its legal pages, which this site doesn't have, it says who makes Verge.
 */
export function VergeFooter() {
  return (
    <footer className="surface-reading border-t border-hairline">
      <div className="mx-auto w-full px-16 md:px-48 max-w-[1200px] pb-48">
        <div className="border-hairline mt-0 border-t-0 pt-48">
          <p className="max-w-measure text-small text-muted">
            Verge gives training guidance. It does not give medical advice. See a doctor or a sports medicine professional before you start a new
            program, and if you have pain or an injury.
          </p>
        </div>
        <div className="mt-48 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-64">
          <div className="flex items-start justify-between gap-16 lg:block">
            <p className="flex min-h-target items-center gap-8 font-display text-[20px] leading-none">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="24" height="24" aria-hidden="true">
                <path d="M101.9 123 80.2 52H38.2L92 228 178.2 66H132.2Z" fill="var(--ink)" />
                <path d="M185.6 52 205.8 14H159.8L139.6 52Z" fill="var(--accent)" />
              </svg>
              Verge
            </p>
            <p className="text-body lg:mt-16">
              <a href="#waitlist" className={`inline-flex min-h-target items-center ${LINK}`}>
                Sign in
              </a>
            </p>
          </div>
          <p className="mt-24 max-w-measure text-body lg:mt-0">
            Verge is made by{' '}
            <a href="/" className={LINK}>
              Crucible
            </a>
            .
          </p>
        </div>
      </div>
    </footer>
  );
}
