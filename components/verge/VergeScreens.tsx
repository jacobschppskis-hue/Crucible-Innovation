// Four of Verge's real screens, rendered from its previews with a made-up athlete (public/verge/screens, 440 and 880
// wide). The Activities and Progress screens are left out because they name the watch the data came from.
const SCREENS = [
  { file: 'today', caption: 'Today, with what to train and why' },
  { file: 'plan', caption: 'Your week, and how hard each session is' },
  { file: 'ask', caption: 'Ask Verge to move a session' },
  { file: 'profile', caption: 'What Verge has learned about you' },
];

/** A row of phone screens that scrolls sideways on a phone and fits the page column on a wide screen. */
export function VergeScreens() {
  return (
    <section aria-labelledby="screens-title" className="surface-reading py-64 lg:py-96">
      <div className="mx-auto w-full max-w-[1200px] px-16 md:px-48">
        <h2 id="screens-title" className="font-display text-headline">
          Look around
        </h2>
        <p className="mt-12 max-w-measure text-body text-muted">Screens from the app, with a made-up athlete and made-up numbers.</p>
      </div>
      <ul role="list" className="mx-auto mt-32 flex max-w-[1200px] snap-x snap-mandatory scroll-px-16 gap-24 overflow-x-auto px-16 pb-16 md:scroll-px-48 md:px-48">
        {SCREENS.map((s) => (
          <li key={s.file} className="w-[220px] shrink-0 snap-start sm:w-[240px]">
            <img
              src={`/verge/screens/${s.file}-440.webp`}
              srcSet={`/verge/screens/${s.file}-440.webp 440w, /verge/screens/${s.file}-880.webp 880w`}
              sizes="240px"
              width={440}
              height={956}
              loading="lazy"
              decoding="async"
              alt={`The Verge app: ${s.caption.charAt(0).toLowerCase()}${s.caption.slice(1)}.`}
              className="h-auto w-full rounded-[20px] border border-hairline"
            />
            <p className="mt-12 text-small">{s.caption}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
