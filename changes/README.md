# changes/

Everything a future contributor (human or agent) needs to know about how this
copy of Oneiromancy got to where it is, and the rules for changing it.

## Read these first

1. [`AGENT_UX_GUIDELINES.md`](AGENT_UX_GUIDELINES.md): **the owner's mission
   and the rules.** The mission at the top overrides everything else.
2. [`ARCHITECTURE.md`](ARCHITECTURE.md): how the app works **today**: data
   flow, scoring model, screens, recommendation rules, persistence, tests and
   validation.
3. [`DECISIONS.md`](DECISIONS.md): every product decision, who made it (owner
   or agent), and whether it still stands.

## History (chronological logs)

These describe what changed at the time. Later entries may supersede earlier
ones; `DECISIONS.md` says which. Don't treat an old log as the current state.

| Log | What it covers |
| --- | --- |
| [`2026-10-10-private-copy-build-fixes-cloudflare.md`](2026-10-10-private-copy-build-fixes-cloudflare.md) | Private copy of google/oneiromancy, lockfile and build fixes, Cloudflare Workers deployment |
| [`2026-10-10-live-site-audit.md`](2026-10-10-live-site-audit.md) | First audit of the live site with a real Sleeper account |
| [`2026-10-10-live-site-fixes.md`](2026-10-10-live-site-fixes.md) | Fixes from that audit: real byes, dates, matchups, records; polling |
| [`2026-10-10-ux-review.html`](2026-10-10-ux-review.html) | UX review and mock-ups (open in a browser) |
| [`2026-10-10-ux-rework.md`](2026-10-10-ux-rework.md) | Implementing the review, then every owner follow-up (read-only, Stars in every value, the mission, λ 0.75, welcome and mock, headshots, head-to-head, leaderboard restored, telemetry on This Week, Oracle panel) |
| [`2026-10-11-validation-pass.md`](2026-10-11-validation-pass.md) | Tests revisited (457 passing), full UI walkthrough against Sleeper ground truth, findings and open questions |

## Adding to this folder

- One log per piece of work: `YYYY-MM-DD-short-name.md`. Say what changed, why,
  and how it was verified.
- Add a row to `DECISIONS.md` for every product decision, marking owner vs
  agent, and mark anything it supersedes.
- Update `ARCHITECTURE.md` whenever the current state changes.
