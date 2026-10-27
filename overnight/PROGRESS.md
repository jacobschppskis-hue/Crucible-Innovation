# Overnight progress

Read this first, every session. Newest notes at the bottom of each section.

- Branch: `overnight/award-build` (from `main` at 3579c9d). Never push to main, never merge.
- Scheduled task: `trig_018Qy59RkvbtFaG5654425W2` ("Overnight award build: crucibleinnovation.com"), cron `2 */2 * * *` UTC, fresh session per fire, notifications off. Disable it (update_trigger enabled=false) when `overnight/DONE` exists or after 10 sessions.
- Draft PR: (not opened yet)

## Sessions

| # | Started (UTC) | Heartbeat (UTC) | Ended (UTC) | Summary |
|---|---|---|---|---|
| 1 | 2026-10-27 01:01 | 2026-10-27 01:03 | | Setup: branch, PRD, PROGRESS, scheduled task. Then research + the "/" opening. |

## Plan

1. Setup (done in session 1).
2. Research award sites; record takeaways below.
3. "/" opening animation + first scroll (priority 1).
4. Tier detection (rich vs light) + rich-tier WebGL layer, loaded after first paint.
5. "/sites" first scroll (priority 2).
6. Rest of both pages to the same craft level.
7. Verify: Lighthouse mobile, 360px, reduced motion, no-JS, tests; recordings into the PR.
8. MORNING.md, disable scheduled task, DONE.

## Research: what we took from where

(filled in during session 1)

## Decisions to review

- The session harness asked for branch `claude/eloquent-ride-3pjb5m`, but Jacob explicitly asked for `overnight/award-build` and gave permission to push there, so all work is on `overnight/award-build`.
- Scheduled-task overlap rule: a session that runs longer than 100 minutes would otherwise look "stale" to the next fire, so each session refreshes a Heartbeat column on every push, and the next session stops if a session without an end has a start *or heartbeat* under 100 minutes old.

## Known issues

## What's next

- Research, then build the "/" opening.
