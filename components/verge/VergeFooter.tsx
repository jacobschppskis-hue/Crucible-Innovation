import { site } from '@/data/site';

const LINK = 'underline decoration-1 underline-offset-4 hover:decoration-2';

/** Verge's footer on this site: its health disclaimer, who makes it, and what the waitlist email is used for. */
export function VergeFooter() {
  return (
    <footer className="surface-reading border-t border-hairline">
      <div className="mx-auto w-full max-w-[1200px] px-16 pb-48 md:px-48">
        <p className="max-w-measure pt-48 text-small text-muted">
          Verge gives training guidance. It does not give medical advice. See a doctor or a sports medicine professional before you start a new
          program, and if you have pain or an injury.
        </p>
        <div className="mt-48 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-64">
          <p className="flex min-h-target items-center gap-8 font-display text-[20px] leading-none">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="24" height="24" aria-hidden="true">
              <path d="M101.9 123 80.2 52H38.2L92 228 178.2 66H132.2Z" fill="var(--ink)" />
              <path d="M185.6 52 205.8 14H159.8L139.6 52Z" fill="var(--accent)" />
            </svg>
            Verge
          </p>
          <div className="mt-24 max-w-measure space-y-12 text-body lg:mt-0">
            <p>
              Verge is made by{' '}
              <a href="/ventures" className={LINK}>
                Crucible
              </a>
              .
            </p>
            <p className="text-muted">
              Your email is used only to tell you about Verge, and about the private beta if you ask. It is never sold or shared.{' '}
              <a href={`mailto:${site.email}?subject=${encodeURIComponent('Delete my Verge waitlist email')}`} className={LINK}>
                Email us
              </a>{' '}
              and we’ll delete it.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
