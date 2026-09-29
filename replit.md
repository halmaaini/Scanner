# Attendance

Check people in at events (rehearsal, graduation, trophy handover, ...) by
scanning a QR code or typing a student ID. Admins scan, even offline; one super
admin sees a report; students open a public page with their card. Everything
else (import, revoke, open events, create admins) is SQL; see `docs/admin-sql.md`.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev`: build and run the API server (port 8080). It applies database migrations itself on start; there is no separate migrate/push step.
- `pnpm --filter @workspace/web run dev`: run the web app (Replit sets `PORT` and `BASE_PATH`).
- `pnpm run typecheck`: typecheck everything (run this from the root; it builds the shared libs first).
- `pnpm test`: unit tests. Database/API tests run only when `TEST_DATABASE_URL` is set to a **scratch** database whose name contains `test` (it is wiped); without it they are **skipped**, and a warning says so.
- `pnpm --filter @workspace/e2e test:e2e`: browser tests (need `TEST_DATABASE_URL` and a Chromium: `pnpm --filter @workspace/e2e exec playwright install chromium`, or set `CHROMIUM_PATH`).
- `pnpm --filter @workspace/api-spec run codegen`: regenerate `lib/api-zod` and `lib/api-client-react` from `lib/api-spec/openapi.yaml` (generated files are committed). `pnpm run check:generated` fails if they are out of date.
- `pnpm --filter @workspace/db run generate`: write a new SQL migration after a schema change (Claude does this; you do not need to).
- `pnpm --filter @workspace/scripts run sql <file.sql>`: run a SQL file (no TTY needed) against `DATABASE_URL` (in a workspace shell, the **development** database). It prints `SELECT` results. `lib/db/sql/seed-demo.sql` is development-only demo data and refuses to load into a database that holds anything else.

Environment:

| Variable                             | Meaning                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------ |
| `DATABASE_URL`                       | Postgres (provided by Replit). Development and Production each have their own. |
| `SESSION_SECRET`                     | Any long random string; the API refuses to start in production without it.     |
| `PORT`, `BASE_PATH`                  | Set per artifact by Replit (see the `artifact.toml` files).                    |
| `TRUST_PROXY_HOPS`                   | Proxies in front of the API; default 1. See "After the first publish" below.   |
| `LOG_LEVEL`                          | `info` by default; `silent` in tests.                                          |
| `API_PROXY_TARGET`                   | Web dev server only: where `/api` is sent (default `http://127.0.0.1:8080`).   |
| `TEST_DATABASE_URL`, `CHROMIUM_PATH` | Tests only (see above).                                                        |

## First run

There are **no accounts** until someone creates one. The owner creates the first
super admin (and imports students and events) with SQL, in the **Production**
database: "First-time setup" in `docs/admin-sql.md`. The database makes up the
password and shows it once (or the owner types their own): do not invent or
store passwords for them, and do not load the demo data into Production. To try
the app on the _development_ database, load the demo data (see above). You
cannot write to the Production database yourself: the owner does, from the
Database tool. Do not start the owner on First-time setup until your report
says the published site started and what the Production SQL runner accepts.

## Before you publish

1. `SESSION_SECRET` is set as a **deployment** secret (any long random
   string). Without it the API exits right after migrating and the deployment
   fails its health check.
2. The app has a database (`DATABASE_URL` is provided; Production gets its own
   when you publish).
3. In development the API log says "Database migrations are up to date".

## After the first publish (please check and report)

**You (the Replit agent)**: all of this is read-only; you cannot write to
Production.

1. The API's Production log says "Database migrations are up to date" with an
   `outcome`: `migrated`, or `adopted` when Replit's copy of the tables had
   already done everything. If it also says "Some of the schema was already in
   place", its `alreadyInPlace` list is what Replit's copy created (tables,
   columns, constraints, indexes): report it, it tells us exactly what the copy
   includes. A failure that says "part of the schema ... Missing: ..." means
   the copy left out something the migrations cannot add (a column, or a check
   inside a table): report it verbatim.
2. `curl -I` the published `/sw.js` (must be JavaScript, not HTML),
   `/manifest.webmanifest`, and a deep link such as `/card/1001` (must return
   the app page, `text/html`). `/api/healthz` must return 200.
3. Client addresses. `curl -si https://<published>/api/cards/1` prints a
   `RateLimit: limit=…, remaining=…` header; repeat it and `remaining` goes
   down by one each time. Then repeat it with `-H 'X-Forwarded-For: 9.9.9.9'`:
   `remaining` must keep going down. If it starts again from the top, a caller
   can pick their own address: `TRUST_PROXY_HOPS` is too high. (Too low, every
   visitor looking like the proxy, shows up as different people locking each
   other out at sign-in: raise it, restart, and say so.)
4. Production is empty and ready. Read-only queries: `SELECT count(*) FROM
staff` must be 0 (no demo accounts); `SELECT extname FROM pg_extension WHERE
extname = 'pgcrypto'` must return a row; `SELECT table_name FROM
information_schema.tables WHERE table_schema = 'public'` must list
   `events`, `registrations`, `sessions`, `staff` and `students`.
5. Whether `DATABASE_URL` is a pooled endpoint. The migrations hold a session
   advisory lock, which a transaction-mode pooler does not honour. (Replit's
   documentation says production databases are not pooled by default.)
6. What the Database tool offers for Production: whether its SQL runner accepts
   writes, several statements at once, `BEGIN` ... `COMMIT` and `DO` blocks,
   and what backup or export exists. Report it, so `docs/admin-sql.md` ("Where
   to run SQL", rule 4) can be corrected.

**The owner** does these, once your report is in (ask them, and record what
they say):

7. Creates the super admin ("First-time setup" in `docs/admin-sql.md`) and
   signs in on the **published** address. The sign-in response must set the
   `sid` cookie with `Secure` (browser developer tools, Application, Cookies):
   the API relies on Replit's proxy sending `X-Forwarded-Proto: https`.

## Handoff protocol (Claude ⇄ Replit)

This repo is worked by two agents that hand off through committed markdown.

- **Claude Code** makes code changes, pushes them, and writes a handoff at `Claude Handoffs/NNN-slug.md`: the commit hash plus the exact runtime steps you must run.
- **You (Replit agent)**, when the user says _"read NNN-xxx.md"_: pull the branch named in that handoff, follow it (install, restart, **publish**), then **write your report** to `Replit Handoffs/NNN-slug.md` (same number + slug) using `Replit Handoffs/_TEMPLATE.md`.
- Your report covers: each step's result (✅/❌), any commits you made, publish status, the verification outcome, and **open questions / next instructions for Claude**. Keep it self-contained; Claude reads only that one file.
- `HANDOFFS.md` shows each round's **Status**. **Act only on rounds marked `📤 pending Replit`**; while a round is `🚧 in progress (Claude)`, wait. After you verify live and deploy, set the row to `✅ done & deployed`.
- **Net-new issues or specs** (a bug you found, a new feature) go in `Replit Requests/NNN-slug.md` using `Replit Requests/_TEMPLATE.md`, not in a round report.

Always write the report and update the ledger; that is how Claude picks up the next round.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5, sessions in Postgres (`express-session` + `connect-pg-simple`), rate limiting, helmet
- DB: PostgreSQL + Drizzle ORM; versioned SQL migrations applied at API start; `pgcrypto` for password hashing
- API contract: OpenAPI, with Zod validators and a React Query client generated by Orval
- Web: React 19, Vite 7, Tailwind 4, wouter, TanStack Query (persisted), `qr-scanner`, `qrcode.react`; installable PWA (`vite-plugin-pwa`)
- Tests: Vitest (unit, API, DB), Playwright (browser)

## Where things live

`README.md` has the full map and the table of single sources of truth. The short version:

- Database shape: `lib/db/src/schema` (migrations in `lib/db/migrations` are generated from it)
- API contract: `lib/api-spec/openapi.yaml`
- Shared rules (judging a scan, ID cleaning, permissions): `lib/attendance`
- API server: `artifacts/api-server/src` (`routes/` are thin, logic is in `services/`)
- Web app: `artifacts/web/src` (`domain/` pure functions, `offline/` the outbox and sync, `features/` screens, `messages.ts` all wording)
- Owner's SQL cookbook: `docs/admin-sql.md`

## Architecture decisions

- **The roster is the one read model.** `GET /api/roster` returns events, students, registrations and staff names (a few hundred rows). The scanner, the counts, the report, the CSV export and the offline copy are all views of it, so numbers cannot disagree.
- **One write path.** Every check-in and undo is queued in an outbox on the device, then sent in order. Online, the server's answer is shown; offline, the phone predicts with the same shared rules and marks the answer "offline". Anything the server later refuses is listed, never dropped.
- **A registration row is also the attendance record**: expected and attended cannot drift apart. The `events.is_open` switch only controls what scanners offer; the server accepts scans for any existing event so an offline scan is never lost when an event closes.
- **Passwords are hashed by Postgres (`crypt`) when the owner creates an account with SQL, and checked by the API** with bcrypt (`bcryptjs`; the same `$2a$` hashes). The password is never sent to the database when someone signs in, so it cannot appear in a query, an error or a log.
- **Migrations run at API start** (advisory-locked, in one transaction), because `drizzle-kit push` needs a TTY that Replit's shell lacks. They are **structure only**: change data with SQL (`docs/admin-sql.md`). Replit copies the development database's structure to Production when publishing, so a step whose result is already there ("already exists") is skipped and the rest run; afterwards the schema must match the latest migration or nothing is kept (`lib/db/src/migrate.ts`). Keep migrations additive: a step that only removes something Replit's copy already removed is not covered.
- **The student ID rule is written once** (`lib/attendance`): the scanner cleans every ID with it, and the database refuses to store an ID it would change.

## User preferences

- Keep answers short; do not over-explain.
- Clean, simple code; one source of truth for every fact; no shortcuts or quick fixes.
- Check every affected part (code, functions, UI, reports, DB, API) and update all of it together.
- If a decision is the user's to make, stop and ask before continuing.

## Gotchas

- Do not run `drizzle-kit push`. The API applies migrations when it starts; watch its log for "Database migrations are up to date".
- Development and Production are separate databases. The agent cannot write Production; the owner does (Database tool). Tests and the demo seed are for scratch/development databases only.
- The web artifact needs `sw.js` served as JavaScript from the site root. If the static host rewrites unknown paths to `index.html`, make sure existing files (`sw.js`, `manifest.webmanifest`, `assets/*`) are served first. The app registers the service worker itself (there is no `registerSW.js`) and shows a "new version" bar when you publish an update.
- The camera needs HTTPS (or `localhost`); Replit's preview and published URLs are HTTPS.
- `[postMerge]` runs only on a pull or merge. If you check out a branch by hand, run `pnpm install` yourself.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
