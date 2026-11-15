// Verge's own landing page, before launch, on the Crucible site (/verge).
//
// Converted from Verge's landing page in preview mode (the Verge repo's components/landing/Landing.tsx, rendered at
// /dev/reserve) so the page looks exactly like Verge. Its classes are Verge's, styled only by ./verge.css, which is
// scoped to .verge-page (see README.md). Copy edits for this site: no prices, no device or service names, one waitlist
// form (./WaitlistForm.tsx) with a link back to it at the end, and the site's own screens and footer.
import { VergeFooter } from './VergeFooter';
import { VergeScreens } from './VergeScreens';
import { WaitlistForm } from './WaitlistForm';

export function VergeLanding() {
  return (
    <div className="min-h-screen bg-ground text-ink">
      <div className="surface-field">
        <div className="mx-auto w-full px-16 md:px-48 max-w-[1200px]">
          <header className="flex items-center justify-between gap-16 py-16">
            <a aria-label="Verge, top of the page" className="flex min-h-target items-center gap-8 font-display text-[24px] leading-none" href="/verge">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="32" height="32" aria-hidden="true">
                <path d="M99 147.5 71.9 58.8H43.6L92.2 218 175.1 62.2H144.4Z" fill="var(--ink)" />
                <path d="M178.7 55.4 196.4 22H165.7L148 55.4Z" fill="var(--accent)" />
              </svg>
              Verge
            </a>
            <a href="/ventures/verge" className="inline-flex min-h-target items-center text-small underline decoration-1 underline-offset-4 hover:decoration-2">A Crucible venture</a>
          </header>
        </div>
      </div>
      <main id="main">
        <div className="surface-field">
          <div className="mx-auto w-full px-16 md:px-48 max-w-[1200px] pb-48 pt-16 sm:pt-32 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:gap-64 lg:pb-96 lg:pt-48">
            <div className="lg:flex lg:flex-col lg:justify-between">
              <div>
                <h1 className="font-display text-display lg:-mt-8">What to train today, and why</h1>
                <p className="mt-16 max-w-[31em] text-body sm:mt-24 sm:text-[21px] sm:leading-[1.4]">
                  Verge reads last night’s sleep, heart rate variability and resting heart rate against your own usual. Then it tells you what to train today
                  <span className="hidden sm:inline">, and moves a hard session to a better day when you need the recovery</span>
                  .
                </p>
                <WaitlistForm className="mt-24 sm:mt-32" />
              </div>
              <p className="mt-32 hidden text-body text-muted sm:block lg:mt-0">For runners, cyclists, triathletes and Nordic skiers.</p>
            </div>
            <figure className="relative mt-32 lg:mt-0">
              <div className="border border-hairline">
                <div className="px-16 pb-24 pt-16 sm:px-24 sm:pt-24">
                  <p className="text-small text-muted">Tuesday 10 November</p>
                  <p className="mt-8 font-display text-[26px] leading-[1.08] sm:text-[28px]">Easy today. Threshold intervals moved to Wednesday.</p>
                  <p className="mt-16 font-display text-title">Easy run</p>
                  <p className="mt-4 text-body">45 minutes, heart rate 128 to 142</p>
                </div>
                <div className="surface-reading px-16 pb-24 pt-16 sm:px-24 sm:pt-24">
                  <ul role="list" className="divide-y divide-hairline">
                    <li className="flex items-baseline justify-between gap-x-16 py-12 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-body font-medium">Sleep</p>
                        <p className="text-small text-muted">You slept less than you need.</p>
                      </div>
                      <p className="shrink-0 text-right">
                        <span className="block whitespace-nowrap">
                          <span className="font-display text-title leading-none tabular-nums">6</span>
                          <span className="text-small text-muted">{" h"}</span>
                          <span className="font-display text-title leading-none tabular-nums">{" 10"}</span>
                          <span className="text-small text-muted">{" min"}</span>
                        </span>
                        <span className="mt-4 block whitespace-nowrap text-small text-muted tabular-nums">usual 7 h 30 min</span>
                      </p>
                    </li>
                    <li className="flex items-baseline justify-between gap-x-16 py-12 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-body font-medium">Heart rate variability (HRV)</p>
                        <p className="text-small text-muted">Your HRV is below your usual.</p>
                      </div>
                      <p className="shrink-0 text-right">
                        <span className="block whitespace-nowrap">
                          <span className="font-display text-title leading-none tabular-nums">49</span>
                          <span className="text-small text-muted">{" ms"}</span>
                        </span>
                        <span className="mt-4 block whitespace-nowrap text-small text-muted tabular-nums">usual 62 ms</span>
                      </p>
                    </li>
                    <li className="flex items-baseline justify-between gap-x-16 py-12 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-body font-medium">Resting heart rate</p>
                        <p className="text-small text-muted">Your resting heart rate is higher than usual.</p>
                      </div>
                      <p className="shrink-0 text-right">
                        <span className="block whitespace-nowrap">
                          <span className="font-display text-title leading-none tabular-nums">52</span>
                          <span className="text-small text-muted">{" bpm"}</span>
                        </span>
                        <span className="mt-4 block whitespace-nowrap text-small text-muted tabular-nums">usual 47 bpm</span>
                      </p>
                    </li>
                  </ul>
                  <div className="mt-12 border-t border-hairline pt-12">
                    <div>
                      <div className="flex items-baseline justify-between gap-x-16">
                        <div className="min-w-0">
                          <h2 tabIndex={-1} className="text-body font-medium">Readiness</h2>
                          <p className="text-small text-muted">17 points under your usual morning, which sits at 75.</p>
                        </div>
                        <p className="shrink-0 whitespace-nowrap text-right">
                          <span className="font-display text-title leading-none tabular-nums">58</span>
                          <span className="text-small text-muted">{" of"}</span>
                          <span className="font-display text-title leading-none tabular-nums">{" 100"}</span>
                        </p>
                      </div>
                      <div className="relative mt-16 h-16" aria-hidden="true">
                        <div className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-ink" />
                        <div className="absolute top-1/2 h-12 w-[2px] -translate-x-1/2 -translate-y-1/2 bg-ink" style={{ left: "75%" }} />
                        <div className="absolute top-1/2 h-16 w-16 -translate-y-1/2 bg-accent" style={{ left: "calc(58% - 9.28px)" }} />
                      </div>
                      <div className="relative mt-4 h-24 text-small text-muted" aria-hidden="true">
                        <span className="absolute left-0">0</span>
                        <span className="absolute -translate-x-1/2" style={{ left: "75%" }}>usual</span>
                        <span className="absolute right-0">100</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <figcaption className="mt-12 text-small text-muted lg:absolute lg:left-0 lg:top-full">An example morning. The athlete and the numbers are made up.</figcaption>
            </figure>
            <p className="mt-24 text-body text-muted sm:hidden">For runners, cyclists, triathletes and Nordic skiers.</p>
          </div>
        </div>
        <VergeScreens />
        <section aria-labelledby="idea-title" className="surface-field">
          <div className="bg-ground-2">
            <div className="mx-auto w-full px-16 md:px-48 max-w-[1200px] py-64 lg:py-96">
              <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end lg:gap-64">
                <h2 id="idea-title" className="max-w-[12em] font-display text-decision">You get fitter while you recover</h2>
                <p className="mt-16 max-w-measure text-body sm:text-lead lg:mt-0">
                  A hard session leaves you a little worse off than before it. The fitness comes in the days after, while you sleep and go easy. Go hard again too early and you stay under the line. Each morning Verge judges where you are on it from your sleep, heart rate variability and resting heart rate.
                </p>
              </div>
              <figure className="mt-48 lg:mt-64">
                <div className="relative sm:hidden">
                  <svg viewBox="0 0 400 240" className="block h-auto w-full" fill="none" role="img" aria-label="A line that runs level, drops after a hard session, climbs back through recovery and ends above the level it started from.">
                    <defs>
                      <clipPath id="rebound-tall-ink">
                        <path d="M0 0H246.7V98.5H400V240H0Z" />
                      </clipPath>
                      <clipPath id="rebound-tall-tip">
                        <path d="M246.7 30H400V91.5H246.7Z" />
                      </clipPath>
                    </defs>
                    <path d="M0 95H400" className="stroke-muted" strokeWidth="2" strokeDasharray="2 8" />
                    <path d="M0 95H60L110 215L307.5 85" pathLength="1" clipPath="url(#rebound-tall-ink)" className="draw-once stroke-ink" strokeWidth="10" strokeMiterlimit="10" />
                    <path d="M277.1 105L406.2 20" pathLength="1" clipPath="url(#rebound-tall-tip)" className="draw-once draw-once-late stroke-accent" strokeWidth="10" />
                  </svg>
                  <p className="absolute whitespace-nowrap text-small leading-tight sm:text-body sm:leading-tight text-muted" style={{ left: "calc(0% + 0px)", bottom: "calc(62.5% + 8px)" }}>Where you started</p>
                  <p className="absolute whitespace-nowrap text-small leading-tight sm:text-body sm:leading-tight" style={{ left: "calc(20.5% + 6px)", top: "calc(40% + 8px)" }}>A hard session</p>
                  <p className="absolute whitespace-nowrap text-small leading-tight sm:text-body sm:leading-tight" style={{ left: "calc(50% + 0px)", top: "calc(67.4% + 8px)" }}>Recovery</p>
                  <p className="absolute whitespace-nowrap text-small leading-tight sm:text-body sm:leading-tight font-bold" style={{ right: "calc(0% + 0px)", bottom: "calc(87.5% + 8px)" }}>Fitter than before</p>
                </div>
                <div className="relative hidden sm:block">
                  <svg viewBox="0 0 1000 302" className="block h-auto w-full" fill="none" role="img" aria-label="A line that runs level, drops after a hard session, climbs back through recovery and ends above the level it started from.">
                    <defs>
                      <clipPath id="rebound-wide-ink">
                        <path d="M0 0H562.8V145H1000V302H0Z" />
                      </clipPath>
                      <clipPath id="rebound-wide-tip">
                        <path d="M562.8 56H1000V135H562.8Z" />
                      </clipPath>
                    </defs>
                    <path d="M0 140H1000" className="stroke-muted" strokeWidth="2" strokeDasharray="2 8" />
                    <path d="M0 140H170L270 282L762.2 124" pathLength="1" clipPath="url(#rebound-wide-ink)" className="draw-once stroke-ink" strokeWidth="16" strokeMiterlimit="10" />
                    <path d="M662.5 156L1023.8 40" pathLength="1" clipPath="url(#rebound-wide-tip)" className="draw-once draw-once-late stroke-accent" strokeWidth="16" />
                  </svg>
                  <p className="absolute whitespace-nowrap text-small leading-tight sm:text-body sm:leading-tight text-muted" style={{ left: "calc(0% + 0px)", bottom: "calc(56.3% + 8px)" }}>Where you started</p>
                  <p className="absolute whitespace-nowrap text-small leading-tight sm:text-body sm:leading-tight" style={{ left: "calc(21.4% + 16px)", top: "calc(46.7% + 8px)" }}>A hard session</p>
                  <p className="absolute whitespace-nowrap text-small leading-tight sm:text-body sm:leading-tight" style={{ left: "calc(55% + 0px)", top: "calc(66.4% + 8px)" }}>Recovery</p>
                  <p className="absolute whitespace-nowrap text-small leading-tight sm:text-body sm:leading-tight font-bold" style={{ right: "calc(0% + 0px)", bottom: "calc(81.5% + 8px)" }}>Fitter than before</p>
                </div>
              </figure>
            </div>
          </div>
        </section>
        <div className="surface-reading border-y border-hairline">
          <div className="mx-auto w-full px-16 md:px-48 max-w-[1200px] pb-64 lg:pb-96">
            <section id="decides" aria-labelledby="decides-title" className="scroll-mt-32 pt-64 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-64 lg:pt-96">
              <h2 id="decides-title" className="font-display text-headline lg:sticky lg:top-32 lg:self-start">How Verge decides</h2>
              <div className="mt-24 lg:mt-0">
                <div className="max-w-measure space-y-16 text-body sm:text-lead">
                  <p>
                    Verge needs about two weeks of mornings to learn your usual. Until then it tells you the read is an early one.
                  </p>
                  <p>
                    When your readings are well under your usual, a hard session moves to the first day in the next three that was easy or free. It never goes beside another hard day or the day before your long session, and it waits for as long as your heart rate variability usually takes to come back after hard work. Today gets an easy session in its place, or a rest day.
                  </p>
                </div>
                <figure className="mt-32">
                  <ul role="list" className="divide-y divide-hairline border-t border-hairline sm:hidden">
                    <li className="flex gap-16 py-12 text-body">
                      <p className="w-48 shrink-0 font-medium">
                        <span aria-hidden="true">Tue</span>
                        <span className="sr-only">Tuesday</span>
                        <span className="block text-small font-normal text-muted">today</span>
                      </p>
                      <p className="min-w-0">
                        <span className="sr-only">{"Planned, "}</span>
                        <s className="block text-muted">Threshold intervals</s>
                        <span className="sr-only">{"Now, "}</span>
                        <span className="block font-bold">Easy run</span>
                      </p>
                    </li>
                    <li className="flex gap-16 py-12 text-body">
                      <p className="w-48 shrink-0 font-medium">
                        <span aria-hidden="true">Wed</span>
                        <span className="sr-only">Wednesday</span>
                      </p>
                      <p className="min-w-0">
                        <span className="sr-only">{"Planned, "}</span>
                        <s className="block text-muted">Easy run</s>
                        <span className="sr-only">{"Now, "}</span>
                        <span className="block font-bold">Threshold intervals</span>
                      </p>
                    </li>
                    <li className="flex gap-16 py-12 text-body">
                      <p className="w-48 shrink-0 font-medium">
                        <span aria-hidden="true">Thu</span>
                        <span className="sr-only">Thursday</span>
                      </p>
                      <p className="min-w-0 text-muted">Easy run</p>
                    </li>
                    <li className="flex gap-16 py-12 text-body">
                      <p className="w-48 shrink-0 font-medium">
                        <span aria-hidden="true">Fri</span>
                        <span className="sr-only">Friday</span>
                      </p>
                      <p className="min-w-0 text-muted">Rest</p>
                    </li>
                  </ul>
                  <table className="hidden w-full border-collapse text-left text-body normal-nums sm:table">
                    <thead>
                      <tr className="text-small text-muted">
                        <th scope="col" className="w-[30%] pb-8 pr-16 font-normal">
                          <span className="sr-only">Day</span>
                        </th>
                        <th scope="col" className="w-[35%] pb-8 pr-16 font-normal">Planned</th>
                        <th scope="col" className="pb-8 font-normal">Now</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-hairline align-baseline">
                        <th scope="row" className="py-12 pr-16 font-medium">
                          Tuesday
                          <span className="ml-8 text-small font-normal text-muted">today</span>
                        </th>
                        <td className="py-12 pr-16 text-muted line-through">Threshold intervals</td>
                        <td className="py-12 font-bold">Easy run</td>
                      </tr>
                      <tr className="border-t border-hairline align-baseline">
                        <th scope="row" className="py-12 pr-16 font-medium">Wednesday</th>
                        <td className="py-12 pr-16 text-muted line-through">Easy run</td>
                        <td className="py-12 font-bold">Threshold intervals</td>
                      </tr>
                      <tr className="border-t border-hairline align-baseline">
                        <th scope="row" className="py-12 pr-16 font-medium">Thursday</th>
                        <td className="py-12 pr-16 text-muted ">Easy run</td>
                        <td className="py-12 text-muted">Easy run</td>
                      </tr>
                      <tr className="border-t border-hairline align-baseline">
                        <th scope="row" className="py-12 pr-16 font-medium">Friday</th>
                        <td className="py-12 pr-16 text-muted ">Rest</td>
                        <td className="py-12 text-muted">Rest</td>
                      </tr>
                    </tbody>
                  </table>
                  <figcaption className="mt-12 text-small text-muted">An example. The sessions are made up.</figcaption>
                </figure>
                <div className="mt-32 max-w-measure space-y-12 text-body">
                  <p>
                    If no day fits, or a goal race is within a week, the hard session becomes an easy one. When your readings are only a little off, a hard session is cut to about 80 percent and stays on its day.
                  </p>
                  <p>
                    You see what changed and why. Any planned session downloads as a FIT workout file that you copy to your watch or bike computer.
                  </p>
                </div>
              </div>
            </section>
            <section id="training" aria-labelledby="training-title" className="scroll-mt-32 pt-64 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-64 lg:pt-96">
              <h2 id="training-title" className="font-display text-headline lg:sticky lg:top-32 lg:self-start">How it trains you</h2>
              <div className="mt-24 lg:mt-0">
                <div className="max-w-measure space-y-16 text-body sm:text-lead">
                  <p>
                    Verge uses the intensity scale of Olympiatoppen, the elite sport centre of Norway’s Olympic committee. It has eight zones. I-1 to I-5 are set by heart rate, and once Verge knows your own two thresholds it puts the lines there. I-6 to I-8 are short, very hard efforts set by how long they last.
                  </p>
                  <p>
                    Most of the week is easy, in I-1. Threshold work in I-3 and I-4 is held under control by pace or power, heart rate and how it feels, so you can do it again a few days later. The hardest sessions stay on the plan only on days you have recovered enough for them.
                  </p>
                </div>
                <figure className="mt-32">
                  <ul role="list" className="divide-y divide-hairline border-y border-hairline">
                    <li className="grid grid-cols-[3.25em_minmax(0,1fr)_auto] items-baseline gap-x-16 py-12 text-body sm:grid-cols-[3.25em_minmax(0,1fr)_minmax(0,1fr)_5em]">
                      <span className="font-display font-bold tabular-nums">I-1</span>
                      <span className="min-w-0">
                        <span className="block font-medium">Very light</span>
                        <span className="block text-small text-muted">55 to 72 percent of max heart rate</span>
                      </span>
                      <span aria-hidden="true" className="col-start-2 row-start-2 block self-center sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:mt-0 sm:h-12 col-span-2 mt-8 h-12">
                        <span className="block h-12 min-w-[4px] bg-zone-1" style={{ width: "100%" }} />
                      </span>
                      <span className="text-right tabular-nums ">5 h 20</span>
                    </li>
                    <li className="grid grid-cols-[3.25em_minmax(0,1fr)_auto] items-baseline gap-x-16 py-12 text-body sm:grid-cols-[3.25em_minmax(0,1fr)_minmax(0,1fr)_5em]">
                      <span className="font-display font-bold tabular-nums">I-2</span>
                      <span className="min-w-0">
                        <span className="block font-medium">Fairly light</span>
                        <span className="block text-small text-muted">72 to 82 percent of max heart rate</span>
                      </span>
                      <span aria-hidden="true" className="col-start-2 row-start-2 block self-center sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:mt-0 sm:h-12 col-span-2 mt-8 h-12">
                        <span className="block h-12 min-w-[4px] bg-zone-2" style={{ width: "18.75%" }} />
                      </span>
                      <span className="text-right tabular-nums ">1 h</span>
                    </li>
                    <li className="grid grid-cols-[3.25em_minmax(0,1fr)_auto] items-baseline gap-x-16 py-12 text-body sm:grid-cols-[3.25em_minmax(0,1fr)_minmax(0,1fr)_5em]">
                      <span className="font-display font-bold tabular-nums">I-3</span>
                      <span className="min-w-0">
                        <span className="block font-medium">Somewhat hard</span>
                        <span className="block text-small text-muted">82 to 87 percent of max heart rate</span>
                      </span>
                      <span aria-hidden="true" className="col-start-2 row-start-2 block self-center sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:mt-0 sm:h-12 col-span-2 mt-8 h-12">
                        <span className="block h-12 min-w-[4px] bg-zone-3" style={{ width: "12.5%" }} />
                      </span>
                      <span className="text-right tabular-nums ">40 min</span>
                    </li>
                    <li className="grid grid-cols-[3.25em_minmax(0,1fr)_auto] items-baseline gap-x-16 py-12 text-body sm:grid-cols-[3.25em_minmax(0,1fr)_minmax(0,1fr)_5em]">
                      <span className="font-display font-bold tabular-nums">I-4</span>
                      <span className="min-w-0">
                        <span className="block font-medium">Hard</span>
                        <span className="block text-small text-muted">87 to 92 percent of max heart rate</span>
                      </span>
                      <span aria-hidden="true" className="col-start-2 row-start-2 block self-center sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:mt-0 sm:h-12 col-span-2 mt-8 h-12">
                        <span className="block h-12 min-w-[4px] bg-zone-4" style={{ width: "6.25%" }} />
                      </span>
                      <span className="text-right tabular-nums ">20 min</span>
                    </li>
                    <li className="grid grid-cols-[3.25em_minmax(0,1fr)_auto] items-baseline gap-x-16 py-12 text-body sm:grid-cols-[3.25em_minmax(0,1fr)_minmax(0,1fr)_5em]">
                      <span className="font-display font-bold tabular-nums">I-5</span>
                      <span className="min-w-0">
                        <span className="block font-medium">Very hard</span>
                        <span className="block text-small text-muted">92 percent of max heart rate and up</span>
                      </span>
                      <span aria-hidden="true" className="col-start-2 row-start-2 block self-center sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:mt-0 sm:h-12 hidden sm:block" />
                      <span className="text-right tabular-nums text-muted">None</span>
                    </li>
                    <li className="grid grid-cols-[3.25em_minmax(0,1fr)_auto] items-baseline gap-x-16 py-12 text-body sm:grid-cols-[3.25em_minmax(0,1fr)_minmax(0,1fr)_5em]">
                      <span className="font-display font-bold tabular-nums">I-6</span>
                      <span className="min-w-0">
                        <span className="block font-medium">Very, very hard</span>
                        <span className="block text-small text-muted">Reps of 30 seconds to 2 minutes</span>
                      </span>
                      <span aria-hidden="true" className="col-start-2 row-start-2 block self-center sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:mt-0 sm:h-12 hidden sm:block" />
                      <span className="text-right tabular-nums text-muted">None</span>
                    </li>
                    <li className="grid grid-cols-[3.25em_minmax(0,1fr)_auto] items-baseline gap-x-16 py-12 text-body sm:grid-cols-[3.25em_minmax(0,1fr)_minmax(0,1fr)_5em]">
                      <span className="font-display font-bold tabular-nums">I-7</span>
                      <span className="min-w-0">
                        <span className="block font-medium">Very, very hard</span>
                        <span className="block text-small text-muted">Reps of 15 to 60 seconds</span>
                      </span>
                      <span aria-hidden="true" className="col-start-2 row-start-2 block self-center sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:mt-0 sm:h-12 hidden sm:block" />
                      <span className="text-right tabular-nums text-muted">None</span>
                    </li>
                    <li className="grid grid-cols-[3.25em_minmax(0,1fr)_auto] items-baseline gap-x-16 py-12 text-body sm:grid-cols-[3.25em_minmax(0,1fr)_minmax(0,1fr)_5em]">
                      <span className="font-display font-bold tabular-nums">I-8</span>
                      <span className="min-w-0">
                        <span className="block font-medium">Maximal</span>
                        <span className="block text-small text-muted">Sprints of 3 to 15 seconds</span>
                      </span>
                      <span aria-hidden="true" className="col-start-2 row-start-2 block self-center sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:mt-0 sm:h-12 col-span-2 mt-8 h-12">
                        <span className="block h-12 min-w-[4px] bg-zone-5" style={{ width: "1.25%" }} />
                      </span>
                      <span className="text-right tabular-nums ">4 min</span>
                    </li>
                  </ul>
                  <figcaption className="mt-12 text-small text-muted">
                    An example week of 7 h 24 for a runner. The minutes are made up. Your own mix depends on your sport, your level and the time of year.
                  </figcaption>
                </figure>
              </div>
            </section>
            <section id="profile" aria-labelledby="profile-title" className="scroll-mt-32 pt-64 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-64 lg:pt-96">
              <h2 id="profile-title" className="font-display text-headline lg:sticky lg:top-32 lg:self-start">It learns who it is training</h2>
              <div className="mt-24 lg:mt-0">
                <div className="max-w-measure space-y-16 text-body sm:text-lead">
                  <p>
                    Verge builds a profile of each athlete from their own best efforts, races and training. It compares how your speed holds up against your endurance, sets that against what your target event asks for, and watches how fast you come back after hard sessions.
                  </p>
                  <p>
                    Every estimate says how sure Verge is and what would make it surer, usually a short test you can do on your own. It does not measure muscle fibre type or guess at talent.
                  </p>
                </div>
                <figure className="mt-32">
                  <dl className="divide-y divide-hairline border-y border-hairline">
                    <div className="py-16 sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,5fr)] sm:gap-32">
                      <dt className="text-body font-bold">Speed against endurance</dt>
                      <dd className="mt-4 sm:mt-0">
                        <p className="max-w-measure text-body">
                          Your endurance is ahead of your speed. This describes how you perform today, from two measures. It does not say why.
                        </p>
                        <p className="mt-4 text-small text-muted">How sure: fair</p>
                      </dd>
                    </div>
                    <div className="py-16 sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,5fr)] sm:gap-32">
                      <dt className="text-body font-bold">What you can hold</dt>
                      <dd className="mt-4 sm:mt-0">
                        <p className="max-w-measure text-body">
                          Your critical speed is 4.15 m/s, or 4:01 per km. That is about the fastest pace you can hold for 20 to 30 minutes.
                        </p>
                        <p className="mt-4 text-small text-muted">How sure: fair</p>
                      </dd>
                    </div>
                    <div className="py-16 sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,5fr)] sm:gap-32">
                      <dt className="text-body font-bold">Late in long runs</dt>
                      <dd className="mt-4 sm:mt-0">
                        <p className="max-w-measure text-body">
                          In your long sessions your heart rate drifts about 3 percent against the same pace in the second half. Under 5 percent is the usual sign that a session of that length is comfortable.
                        </p>
                        <p className="mt-4 text-small text-muted">How sure: fair</p>
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-16 max-w-measure text-body">
                    To make these surer, do one steady session of 90 minutes or more at an even, easy effort on flat ground or the trainer and run an all-out 3 minutes and an all-out 12 minutes on separate days.
                  </p>
                  <figcaption className="mt-12 text-small text-muted">
                    An example for a made-up runner aiming at a marathon. The sentences are the ones Verge's profile code writes for those numbers.
                  </figcaption>
                </figure>
              </div>
            </section>
            <section id="control" aria-labelledby="control-title" className="scroll-mt-32 pt-64 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-64 lg:pt-96">
              <h2 id="control-title" className="font-display text-headline lg:sticky lg:top-32 lg:self-start">What you control</h2>
              <div className="mt-24 lg:mt-0">
                <dl>
                  <div className="border-t border-hairline py-24 first:border-t-0 first:pt-0 sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,5fr)] sm:gap-32">
                    <dt className="text-body font-bold sm:font-display sm:text-title">How much you train</dt>
                    <dd className="mt-4 sm:mt-0">
                      <p className="max-w-measure text-body">
                        Five levels, from Weekend at 3 to 4 hours a week up to Full time at 20 to 30. Your sessions and the routines around them follow from the level you pick.
                      </p>
                      <p className="mt-8 text-small text-muted">Weekend, Regular, Serious, Competitive, Full time</p>
                    </dd>
                  </div>
                  <div className="border-t border-hairline py-24 first:border-t-0 first:pt-0 sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,5fr)] sm:gap-32">
                    <dt className="text-body font-bold sm:font-display sm:text-title">How much you want to know</dt>
                    <dd className="mt-4 sm:mt-0">
                      <p className="max-w-measure text-body">
                        One sentence a day with the reason in plain words, or every number behind it. You can change this whenever you like.
                      </p>
                      <p className="mt-8 text-small text-muted">Just tell me, Tell me why, Show the numbers, Everything</p>
                    </dd>
                  </div>
                  <div className="border-t border-hairline py-24 first:border-t-0 first:pt-0 sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,5fr)] sm:gap-32">
                    <dt className="text-body font-bold sm:font-display sm:text-title">Who decides</dt>
                    <dd className="mt-4 sm:mt-0">
                      <p className="max-w-measure text-body">
                        Verge can change the plan and tell you, suggest a change and wait for your yes, or only say what it sees. A change it makes can be undone.
                      </p>
                      <p className="mt-8 text-small text-muted">Verge decides, Verge suggests, I decide</p>
                    </dd>
                  </div>
                </dl>
              </div>
            </section>
            <section id="data" aria-labelledby="data-title" className="scroll-mt-32 pt-64 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-64 lg:pt-96">
              <h2 id="data-title" className="font-display text-headline lg:sticky lg:top-32 lg:self-start">Your data and the AI</h2>
              <div className="mt-24 lg:mt-0">
                <div className="max-w-measure space-y-16 text-body sm:text-lead">
                  <p>
                    AI is off until you turn it on. The daily decision, your plan and your numbers come from Verge’s own calculations and work without it.
                  </p>
                  <p>
                    Turn it on and Claude, an AI service made by Anthropic, writes your morning note and your session debriefs, and answers in the chat. In the chat it can also ask Verge to change your plan, and your Who decides setting still applies. Turn it off in Settings and that stops straight away.
                  </p>
                </div>
                <div className="mt-32 grid gap-32 sm:grid-cols-2 sm:gap-48">
                  <div>
                    <h3 className="text-body font-bold">Sent to the AI when it is on</h3>
                    <ul role="list" className="space-y-8 text-body mt-12">
                      <li className="relative pl-16 before:absolute before:left-0 before:top-[0.62em] before:h-4 before:w-4 before:bg-muted">Summaries of your recent sessions and your training load</li>
                      <li className="relative pl-16 before:absolute before:left-0 before:top-[0.62em] before:h-4 before:w-4 before:bg-muted">Sleep, heart rate variability and resting heart rate against your usual, for the kinds you allowed</li>
                      <li className="relative pl-16 before:absolute before:left-0 before:top-[0.62em] before:h-4 before:w-4 before:bg-muted">Your zones, your races and the next seven days of your plan</li>
                      <li className="relative pl-16 before:absolute before:left-0 before:top-[0.62em] before:h-4 before:w-4 before:bg-muted">What you write in the chat, and short notes the AI keeps from earlier chats</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-body font-bold">Never sent</h3>
                    <ul role="list" className="space-y-8 text-body mt-12">
                      <li className="relative pl-16 before:absolute before:left-0 before:top-[0.62em] before:h-4 before:w-4 before:bg-muted">Your name</li>
                      <li className="relative pl-16 before:absolute before:left-0 before:top-[0.62em] before:h-4 before:w-4 before:bg-muted">Your email address</li>
                      <li className="relative pl-16 before:absolute before:left-0 before:top-[0.62em] before:h-4 before:w-4 before:bg-muted">Your date of birth</li>
                      <li className="relative pl-16 before:absolute before:left-0 before:top-[0.62em] before:h-4 before:w-4 before:bg-muted">Your country and time zone</li>
                      <li className="relative pl-16 before:absolute before:left-0 before:top-[0.62em] before:h-4 before:w-4 before:bg-muted">Your password and sign-in details</li>
                      <li className="relative pl-16 before:absolute before:left-0 before:top-[0.62em] before:h-4 before:w-4 before:bg-muted">Payment and billing details</li>
                      <li className="relative pl-16 before:absolute before:left-0 before:top-[0.62em] before:h-4 before:w-4 before:bg-muted">Connection tokens for your devices and apps</li>
                      <li className="relative pl-16 before:absolute before:left-0 before:top-[0.62em] before:h-4 before:w-4 before:bg-muted">GPS traces and locations</li>
                      <li className="relative pl-16 before:absolute before:left-0 before:top-[0.62em] before:h-4 before:w-4 before:bg-muted">Weight, body fat and other body measurements</li>
                      <li className="relative pl-16 before:absolute before:left-0 before:top-[0.62em] before:h-4 before:w-4 before:bg-muted">Injury reports and the notes you write on your profile</li>
                      <li className="relative pl-16 before:absolute before:left-0 before:top-[0.62em] before:h-4 before:w-4 before:bg-muted">Session names and titles</li>
                      <li className="relative pl-16 before:absolute before:left-0 before:top-[0.62em] before:h-4 before:w-4 before:bg-muted">Data from a service whose terms do not allow AI use</li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
        <section aria-labelledby="start-title" className="surface-field">
          <div className="mx-auto w-full px-16 md:px-48 max-w-[1200px] flex flex-col gap-32 py-64 lg:flex-row lg:items-center lg:justify-between lg:gap-64 lg:py-96">
            <div>
              <h2 id="start-title" className="max-w-[14em] font-display text-decision">Be one of the first</h2>
              <p className="mt-16 max-w-measure text-body sm:text-lead">
                Verge is being tested now. The more people sign up, the sooner it opens, because every email shows there are athletes waiting to use it.
              </p>
              <a href="#waitlist" className="mt-32 inline-flex min-h-[56px] w-full items-center justify-center gap-12 bg-ink px-24 text-lead font-medium text-ground hover:opacity-85 active:opacity-75 sm:w-auto sm:min-w-[224px] sm:px-32">Get early access</a>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="224" height="224" className="hidden shrink-0 lg:-mr-[41px] lg:block" aria-hidden="true">
              <path d="M99 147.5 71.9 58.8H43.6L92.2 218 175.1 62.2H144.4Z" fill="var(--ink)" />
              <path d="M178.7 55.4 196.4 22H165.7L148 55.4Z" fill="var(--accent)" />
            </svg>
          </div>
        </section>
      </main>
      <VergeFooter />
    </div>
  );
}
