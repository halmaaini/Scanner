# Handoff 001: Initial build (attendance scanner)

> **DRAFT, not handed off yet.** Replit: do not act on this file until `HANDOFFS.md` shows round 001 as `📤 pending Replit` (Claude is finishing the final review).

|            |                                                            |
| ---------- | ---------------------------------------------------------- |
| **Date**   | 2026-09-29                                                 |
| **Branch** | `claude/zealous-clarke-8buqtk`                             |
| **Commit** | `@@CODE_COMMIT@@`                                          |
| **Status** | ✅ Code complete and pushed: awaiting Replit runtime steps |

> First round: the whole app. `main` on GitHub was created by the owner from this branch's first commits and does not have the later fixes, so **the branch above is the one to run.** Read this file top to bottom; the checks matter as much as the steps.

## Replit Agent: action required (in order)

1. **Get the code.** `git fetch origin claude/zealous-clarke-8buqtk && git checkout claude/zealous-clarke-8buqtk`. `[postMerge]` (`pnpm install`) only fires on a pull or merge, so after a manual checkout run `pnpm install` yourself.
2. **Database.** Make sure the workspace has a PostgreSQL database (`DATABASE_URL` set). Production gets its own when you publish.
3. **Secret.** Add `SESSION_SECRET` (any long random string, e.g. `openssl rand -hex 32`) as a workspace secret **and** a deployment secret. The API refuses to start in production without it. Do not create passwords or accounts for anyone.
4. **Start the API** (the `api-server` artifact's run command). There is no migrate/push step: it applies its own migrations. The log must say `Database migrations are up to date` (`outcome: "migrated"` on a fresh development database). Do not run `drizzle-kit push`.
5. **Check the two artifacts:** web at `/` (port 20126), API at `/api` (port 8080). `GET /api/healthz` returns `{"status":"ok"}`.
6. **Optional, development database only:** `pnpm --filter @workspace/scripts run sql lib/db/sql/seed-demo.sql`, then sign in as `sara / sara-demo-pw` (admin) or `boss / boss-demo-pw` (super admin) and scan a few of `1001`-`1010`. Never load demo data into Production.
7. **Publish.** Replit copies the development database's structure to Production before the API's first start there. The API skips the steps that copy already made and runs the rest, so expect `outcome: "adopted"` (everything was already there) or `"migrated"`, and a second log line "Some of the schema was already in place" whose `alreadyInPlace` list shows exactly what the copy created. **Report that list.** A failure that says "part of the schema ... Missing: ..." must be reported verbatim (the copy left out something a migration cannot add).
8. **Run the checks in `replit.md`**: "Before you publish" first, then "After the first publish", items 1-6 (yours, read-only) and report each result. Item 7 is the owner's: ask them and record what they say.
9. **Hand over to the owner** only after your report says the published site started and what the Production SQL runner accepts. The owner (not you) creates the first super admin, events and students **in the Production database** with `docs/admin-sql.md` -> "First-time setup". You cannot write to Production. Report anything in that document that does not match the Database tool you see (where the SQL runner is, whether it takes several statements, `DO $acct$` blocks, `BEGIN` ... `COMMIT`, and what backup or export exists for Production).
10. Write `Replit Handoffs/001-initial-build.md` (template in that folder) and set the ledger row in `HANDOFFS.md` to `✅ done & deployed` after verifying live.

## Summary

The whole attendance app: staff (1 super admin, several admins) check people in by scanning a QR or typing the student ID, even offline; the super admin sees an attendance report with CSV export; students open a public page, type their ID and see their card and which events they attended. Everything else (import, revoke, renew, events, accounts) is SQL for the owner. Built as a pnpm workspace matching Replit's template (API `/api`, PWA `/`).

## What changed

### Backend

Express 5 API (`artifacts/api-server`): session login (bcrypt hashes made by pgcrypto in SQL, checked in the API), `GET /api/roster` (the one read model), `POST /api/scans` (ordered batches, safe to retry), `DELETE /api/check-ins/...` (undo), public `GET /api/cards/:id`; rate limits; strict OpenAPI contract (zod validation of requests **and** responses). Shared rules in `lib/attendance` (judging a scan, ID cleaning, permissions) are used by the server and by the scanner's offline mode.

### Frontend

React 19 PWA (`artifacts/web`): scanner (camera QR + typed ID, green/amber/red results), an offline outbox that saves scans on the phone and sends them in order, undo, report + CSV, student card. One send at a time, each request built from the live queue (a scan taken back is never sent); answers tied to the scan; new-version prompt.

### Database

PostgreSQL 16 via Drizzle; one generated migration (`lib/db/migrations/0000_init.sql`); the API applies migrations when it starts, in one transaction, skipping steps whose result already exists. Tables: `students`, `events`, `registrations` (the row is also the attendance record), `staff`, `sessions`. The database refuses student IDs the scanner could never match and event ids longer than the API accepts. `pgcrypto` is created by the API at start.

## Reviewer verdicts

@@VERDICTS@@

## Decisions / deviations

Decided without asking the user (technical, documented; the user was told):

- Passwords are **created** with pgcrypto in SQL (`crypt`) and **checked in the API** with bcryptjs, so a password is never sent to the database when someone signs in (it cannot appear in a query, error or log). The cookbook's default is a password the **database makes up and shows once** (one statement, nothing to forget to replace); choosing your own is a second, guarded block.
- Migrations are **structure only** and tolerate Replit copying the schema to Production at publish: a step that fails only because its result already exists is skipped, the rest run, and nothing is kept unless the schema then matches the latest migration. A partial copy that leaves out a separate step (an index or foreign key) is completed; one that leaves out a column or a check inside a table is refused with the missing names.
- The student ID rule lives once in `lib/attendance` (control characters, whitespace and invisible marks are dropped, Arabic digits become 0-9); the database CHECK is built from it and a test proves they agree for every character.
- "Renewing" a student means re-activating (`is_active = true`); the report screen is UI-gated to the super admin while the roster is sent to every staff member (offline scanning needs it).
- No `main` branch existed when the work started; the owner created it. It holds only the first commits.

## Not verified locally (Replit to confirm)

1. Development vs Production database, and what the Production SQL runner accepts (writes, several statements, `DO` blocks, transactions), and what backup or export exists for Production.
2. Publish-time schema copy vs the API's start-time migrations: which of the schema's 46 named objects the copy really creates (see the `alreadyInPlace` log line), including CHECK constraints, the case-insensitive unique index on usernames and foreign keys.
3. `TRUST_PROXY_HOPS` (default 1): client addresses seen by the API, `Secure` cookie via `X-Forwarded-Proto`.
4. Static hosting: `sw.js` is JavaScript (not the app page), `manifest.webmanifest`, deep link `/card/1001` returns `index.html`.
5. Whether `DATABASE_URL` is a pooled endpoint (the migrations use a session advisory lock).
6. Node 24 (developed and tested on Node 22).
7. Installing the PWA and the camera over the published HTTPS URL on a real phone.
8. @@TESTS@@

## Out of scope / follow-up tasks

- The API does not clamp a scan time from a phone with a wrong clock at the lower end (only future times are clamped).
- Retries are idempotent by student state, not by scan id (documented in the spec).
- Signing out needs a connection; a scan that keeps getting HTTP 500 is not given up on (a "server had a problem" notice is shown while it waits).
- Sign-in hashing (bcryptjs, about 0.1 s per attempt) runs on the API's main thread; the login limiter allows 10 failed attempts per address per 15 minutes, which bounds it at this scale.
- A migration step that only _removes_ something Replit's copy already removed fails loudly (it is not skipped); keep migrations additive.
- Invisible characters outside the Basic Multilingual Plane are not stripped from IDs.
- After a dismissed camera permission prompt the app asks the browser again to work out why the camera is off, which can show a second prompt; a reload after allowing it recovers.
- A lot of options remain for later rounds (bulk QR badge printing, an in-app import).

## Smoke test

1. Sign in as an admin on a phone over the published URL; the camera asks for permission; scan a student's QR from `/card/<id>` on another screen: green "Checked in".
2. Scan the same QR again: amber "Already checked in" with who and when.
3. Turn on airplane mode, scan another student: green with the "Offline" note; the footer says `1 waiting to sync`; turn it off: it syncs and the count stays.
4. "Undo check-in" (under "Scan next" on the green result) clears the check-in; the report (super admin) shows the same counts; export the CSV.
5. Open `/card`, type a student ID: the card shows the QR and the events attended.
6. Publish a change: an open scanner shows "A new version of the app is ready" with a Reload button.
