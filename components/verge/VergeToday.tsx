// Verge's Today screen in a phone, with its sample athlete: the Verge repo's /dev/preview/today?palette=spruce, as it
// renders on a 390 px phone, converted to static JSX. Only the phone's classes are kept (no sm:, md:, lg: or xl:), since
// the phone stays phone sized on a wide screen, and the one screen-width rule it had (the tab bar's text from 375 px)
// is a container query in verge-extra.css. Edits for this site: nothing in it does anything. Buttons and the text box
// are spans, and what would go to another part of the app is a link to the waitlist, kept out of the tab order so the
// phone is one stop. Headings are paragraphs, so the page's outline stays the page's. "From Garmin" is gone (no device
// names before launch), and the morning note, which is hidden until asked for, is left out.

const UNDERLINE = 'underline decoration-1 underline-offset-4';
const TAB = 'vg-tab relative flex min-h-[56px] min-w-target shrink items-center justify-center px-4 text-micro';

const MARK = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="32" height="32" aria-hidden="true">
    <path d="M99 147.5 71.9 58.8H43.6L92.2 218 175.1 62.2H144.4Z" fill="var(--ink)" />
    <path d="M178.7 55.4 196.4 22H165.7L148 55.4Z" fill="var(--accent)" />
  </svg>
);

/** A link to the waitlist in place of a link into the app. Clicks go to the form; the keyboard skips it. */
function ToWaitlist({ className, label, children }: { className: string; label?: string; children: React.ReactNode }) {
  return (
    <a href="#waitlist" tabIndex={-1} aria-label={label} className={className}>
      {children}
    </a>
  );
}

function Reading({ name, note, value, unit, usual }: { name: string; note: string; value: React.ReactNode; unit?: string; usual: string }) {
  return (
    <li className="flex items-baseline justify-between gap-x-16 py-12 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-body font-medium">{name}</p>
        <p className="text-small text-muted">{note}</p>
      </div>
      <p className="shrink-0 text-right">
        <span className="block whitespace-nowrap">
          {value}
          {unit ? <span className="text-small text-muted">{` ${unit}`}</span> : null}
        </span>
        <span className="mt-4 block whitespace-nowrap text-small text-muted tabular-nums">usual {usual}</span>
      </p>
    </li>
  );
}

const num = (n: string) => <span className="font-display text-title leading-none tabular-nums">{n}</span>;

function Tab({ name, current = false }: { name: string; current?: boolean }) {
  return (
    <ToWaitlist className={`${TAB} ${current ? 'font-bold text-ink' : 'text-muted'}`}>
      {current ? <span aria-hidden="true" className="absolute left-1/2 top-0 h-[3px] w-32 -translate-x-1/2 bg-ink" /> : null}
      <span className="grid">
        <span aria-hidden="true" className="invisible col-start-1 row-start-1 font-bold">
          {name}
        </span>
        <span className="col-start-1 row-start-1 text-center">{name}</span>
      </span>
    </ToWaitlist>
  );
}

/** The Today screen in a phone frame, with the line under it that says it is an early design. */
export function VergeToday() {
  return (
    <section className="surface-reading py-64 lg:py-96">
      <figure className="mx-auto w-full max-w-[1200px] px-16 md:px-48">
        <div className="vg-phone">
          <div className="vg-screen surface-field">
            <div className="vg-scroll" tabIndex={0} role="region" aria-label="Verge’s Today screen, an example with a made-up athlete">
              <div className="flex items-center justify-between bg-ground pb-4 pl-16 pr-8 pt-8">
                <ToWaitlist label="Verge, go to Today" className="flex h-target min-w-target items-center">
                  {MARK}
                </ToWaitlist>
                <div className="flex items-center">
                  <ToWaitlist className="flex h-target items-center px-12 text-small text-ink">Learn</ToWaitlist>
                  <ToWaitlist label="Ask Verge" className="flex h-target w-target items-center justify-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                      <path d="M4 5h16v11H11l-4 4v-4H4z" />
                    </svg>
                  </ToWaitlist>
                  <ToWaitlist label="Settings and devices, signed in as Sample Athlete" className="flex h-target w-target items-center justify-center">
                    <span aria-hidden="true" className="flex h-32 w-32 shrink-0 items-center justify-center rounded-full border-[1.5px] border-ink text-small font-bold leading-none">
                      S
                    </span>
                  </ToWaitlist>
                </div>
              </div>

              <div className="surface-reading relative min-w-0">
                <div className="surface-field">
                  <div className="mx-auto w-full px-16 pb-32 pt-16">
                    <p className="text-body text-muted">Sunday 8 November</p>
                    <p className="mt-8 max-w-[17em] font-display text-[34px] leading-[1.04]">Easy run today. Your intervals moved to Tuesday.</p>
                    <div className="mt-32">
                      <div className="flex flex-col gap-24">
                        <div className="min-w-0">
                          <p className="font-display text-title">
                            <span className="sr-only">Easy run, </span>45 minutes, heart rate 128 to 142
                          </p>
                        </div>
                        <div>
                          <ToWaitlist className="inline-flex w-full shrink-0 select-none items-center justify-center gap-12 bg-ink px-24 text-center text-lead font-bold text-ground min-h-[56px]">
                            Download for your watch
                          </ToWaitlist>
                          <p className="mt-8 text-small text-muted">A FIT workout file. Copy it to your watch or bike computer and start it from the workouts there.</p>
                        </div>
                      </div>
                      <div className="mt-16">
                        <p className="max-w-measure text-body text-muted">
                          Threshold intervals moved from Sunday to Tuesday.{' '}
                          <span className={`-my-12 inline-flex min-h-target items-center font-medium text-ink ${UNDERLINE}`}>Undo this change</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-hairline">
                  <div className="mx-auto w-full px-16 pb-64">
                    <div className="mt-32">
                      <div className="max-w-[560px]">
                        <p className="text-body font-medium">How do you feel today?</p>
                        <div className="mt-8 flex border-[1.5px] border-ink">
                          {['Good', 'Normal', 'Tired', 'Unwell'].map((f) => (
                            <span key={f} className="flex min-h-48 min-w-0 flex-1 items-center justify-center px-8 text-body text-ink">
                              {f}
                            </span>
                          ))}
                        </div>
                        <p className="mt-8 text-small text-muted">Unwell turns today’s training into rest. A race stays on your plan, and whether you start is your call.</p>
                      </div>
                    </div>

                    <div className="mt-48">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-16 gap-y-4">
                        <p className="font-display text-title">Why</p>
                      </div>
                      <div className="mt-12">
                        <p className="max-w-measure text-body">
                          You slept about an hour and twenty minutes less than usual and your heart rate variability is well under its two-week average.
                        </p>
                        <div className="mt-24 flex flex-wrap gap-x-64 gap-y-32">
                          <div className="min-w-0 max-w-[560px] flex-[3_1_340px]">
                            <ul role="list" className="divide-y divide-hairline">
                              <Reading
                                name="Sleep"
                                note="You slept less than you need."
                                value={
                                  <>
                                    {num('6')}
                                    <span className="text-small text-muted"> h</span>
                                    {num(' 10')}
                                    <span className="text-small text-muted"> min</span>
                                  </>
                                }
                                usual="7 h 30 min"
                              />
                              <Reading name="HRV" note="Your HRV is below your usual." value={num('49')} unit="ms" usual="62 ms" />
                              <Reading name="Resting heart rate" note="Your resting heart rate is higher than usual." value={num('52')} unit="bpm" usual="47 bpm" />
                            </ul>
                            <p className="mt-16 text-body">
                              <ToWaitlist className={`-my-12 inline-flex min-h-target min-w-target items-center ${UNDERLINE}`}>What these readings mean</ToWaitlist>
                            </p>
                          </div>
                          <div className="min-w-0 max-w-[560px] flex-[2_1_260px]">
                            <div className="flex items-baseline justify-between gap-x-16">
                              <div className="min-w-0">
                                <p className="text-body font-medium">Readiness</p>
                                <p className="text-small text-muted">17 points under your usual morning, which sits at 75.</p>
                              </div>
                              <p className="shrink-0 whitespace-nowrap text-right">
                                {num('58')}
                                <span className="text-small text-muted"> of</span>
                                {num(' 100')}
                              </p>
                            </div>
                            <div className="relative mt-16 h-16" aria-hidden="true">
                              <div className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-ink" />
                              <div className="absolute top-1/2 h-12 w-[2px] -translate-x-1/2 -translate-y-1/2 bg-ink" style={{ left: '75%' }} />
                              <div className="absolute top-1/2 h-16 w-16 -translate-y-1/2 bg-accent" style={{ left: 'calc(58% - 9.28px)' }} />
                            </div>
                            <div className="relative mt-4 h-24 text-small text-muted" aria-hidden="true">
                              <span className="absolute left-0">0</span>
                              <span className="absolute -translate-x-1/2" style={{ left: '75%' }}>
                                usual
                              </span>
                              <span className="absolute right-0">100</span>
                            </div>
                          </div>
                        </div>
                        <div className="mt-32 max-w-measure">
                          <p className="text-body font-medium">This week</p>
                          <p className="mt-4 text-body">You are in a build phase. This is a lighter week so the work can sink in.</p>
                        </div>
                        <div className="mt-24 flex flex-wrap gap-x-32 gap-y-8">
                          <span className={`-my-8 inline-flex min-h-target items-center text-body font-medium ${UNDERLINE}`}>Read this morning’s note</span>
                          <span className={`-my-8 inline-flex min-h-target items-center text-body font-medium ${UNDERLINE}`}>Show my training load</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-48 max-w-[560px]">
                      <p className="block text-body font-medium">Ask about today</p>
                      <div className="mt-8 flex gap-8">
                        <span className="flex min-h-48 w-full min-w-0 flex-1 items-center border-[1.5px] border-muted px-12 py-8 text-body text-muted">Why this session?</span>
                        <span className="inline-flex min-h-48 shrink-0 select-none items-center justify-center gap-8 border-[1.5px] border-ink px-24 text-center text-body font-bold text-ink">
                          Ask
                        </span>
                      </div>
                    </div>

                    <div className="mt-64 border-t border-hairline pt-24">
                      <div className="flex flex-wrap items-center gap-x-8">
                        <p className="text-small text-muted">Last sync 8 Nov, 06:42, 2 sources.</p>
                        <span className={`inline-flex min-h-target shrink-0 select-none items-center justify-center gap-8 px-12 text-center text-small font-medium text-ink ${UNDERLINE}`}>
                          Sync now
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between border-t border-hairline bg-ground pl-8 pr-8">
              <Tab name="Today" current />
              <Tab name="Plan" />
              <Tab name="Activities" />
              <Tab name="Progress" />
              <Tab name="Profile" />
            </div>
          </div>
        </div>
        <figcaption className="mt-24 text-center text-small text-muted">Early design. The app will change before launch.</figcaption>
      </figure>
    </section>
  );
}
