# Attendance

Check people in at events by scanning their QR code or typing their student ID.
Built first for a graduation (rehearsal, ceremony, trophy handover) and kept
general enough to reuse.

- **Admins** scan at the door. It works with a weak or missing connection: scans
  are saved on the phone and sent when the signal returns.
- **Every admin** sees the attendance report (who has checked in and who has not, per event, searchable by part of an ID or a name) and can check someone in from it, and export the CSV. **The super admin** also opens and closes events in the app.
- **Attendees** open a public page, type their student ID, and see their card
  (with the QR code, major when available) and which events they have attended.
- **Everything else is SQL**: importing students, revoking and renewing,
  opening events, creating admins. See [`docs/admin-sql.md`](docs/admin-sql.md).

## Try it locally

You need Node 22+ (Replit runs 24), pnpm 10.16+, and PostgreSQL 16. The
workspace settings skip the native binaries of every platform except Linux x64
(what Replit runs); to develop on macOS, Windows or ARM, delete the platform
override lines from `pnpm-workspace.yaml` (the groups for `esbuild`,
`lightningcss`, `@tailwindcss/oxide` and `rollup`) and run `pnpm install` again.

```bash
pnpm install
cp .env.example .env            # then export it: set -a; source .env; set +a

# terminal 1: the API (applies database migrations when it starts)
pnpm --filter @workspace/api-server run dev

# load demo data once (development databases only!)
pnpm --filter @workspace/scripts run sql lib/db/sql/seed-demo.sql

# terminal 2: the web app (proxies /api to the API: port 8080, or API_PROXY_TARGET)
PORT=5173 pnpm --filter @workspace/web run dev
```

Open http://localhost:5173. Sign in as `sara / sara-demo-pw` (admin) or
`boss / boss-demo-pw` (super admin). The student page is `/card`; try ID `1001`.
The camera needs HTTPS or `localhost`; without a camera, type the ID instead.

## Tests

```bash
pnpm run typecheck        # types for every package (also builds the shared libs)
pnpm test                 # unit tests, plus database and API tests if TEST_DATABASE_URL is set
pnpm --filter @workspace/e2e test:e2e   # real browser, real API, real database
pnpm run check:generated  # fails if the generated API code is out of date with the spec
```

`TEST_DATABASE_URL` must be a scratch Postgres database whose name contains
`test` (say `scanner_test`): the tests **wipe** it, and refuse to touch
anything else (they ask the connection which database it is on before wiping).
**Without it the database and API tests are skipped, not passed** (each
package warns once), so a green `pnpm test` on its own does not mean they ran.

To make one locally (the URLs in `.env.example` assume this):

```bash
psql -c "create role scanner login password 'scanner' createdb"
createdb -O scanner scanner_dev && createdb -O scanner scanner_test
```

The browser tests also need Chromium: run
`pnpm --filter @workspace/e2e exec playwright install chromium`, or set
`CHROMIUM_PATH=/path/to/chrome` to use one you have. A Replit workspace has one
database and no scratch one, so the test suites are run outside Replit and each
handoff says whether they were.

## How it is organised

A pnpm workspace, laid out the way Replit's TypeScript template expects.

```
artifacts/api-server   Express 5 API. Thin routes, logic in services/.
artifacts/web          React + Vite + Tailwind PWA (installable, works offline).
lib/db                 Database schema (Drizzle), SQL migrations, demo data.
lib/api-spec           openapi.yaml: the API contract.
lib/api-zod            Generated from the contract: request/response validation.
lib/api-client-react   Typed client and hooks generated from the contract, plus a small hand-written fetch wrapper.
lib/attendance         Rules shared by server and web (scan judging, IDs, roles).
e2e                    Browser tests.
scripts                Run a .sql file; check the generated code is current; Replit post-merge hook.
docs                   The admin SQL cookbook.
```

### One source of truth for each thing

Each fact is defined in exactly one place; everything else is generated from it
or reads it. To change a fact, change it there.

| What                     | Defined in                                                     | Used by                                                                          |
| ------------------------ | -------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Database shape           | `lib/db/src/schema` (migrations are generated from it)         | all server queries; the SQL cookbook is tested against it                        |
| API contract             | `lib/api-spec/openapi.yaml`                                    | server validation and web client, both generated                                 |
| Who can be admitted      | `lib/attendance` `evaluateScan` / `isRecorded`                 | the server, and the scanner's offline mode                                       |
| Student ID cleaning      | `lib/attendance` `normalizeStudentId`                          | server and web; the database's ID check is built from the same rule              |
| The hall's seats         | `lib/attendance/src/hall.ts`                                   | the card's plan, the live Seats view, search and the check that a seat exists    |
| Roles and permissions    | the spec's `StaffRole`, then `lib/attendance`                  | server checks and web menus; the database's copy is checked by a test            |
| What the app knows       | `GET /api/roster`                                              | scanner, report, counts, CSV and the offline copy all read it                    |
| Counting attendance      | `web/src/domain/summary.ts`                                    | scanner header and report                                                        |
| Every write              | the outbox (`web/src/offline`)                                 | scans and undos take the same path                                               |
| All wording              | `web/src/messages.ts`                                          | every screen                                                                     |
| Colours and fonts        | `web/src/index.css`                                            | every screen; the app manifest and icons read it through `web/scripts/theme.mjs` |
| Timings, limits, storage | `web/src/config.ts` (web), `api-server/src/config.ts` (server) | the web app and the browser tests; the server                                    |

New screens and reports should be a new _view of the roster_ (a function in
`web/src/domain`), not a new endpoint. See [`CLAUDE.md`](CLAUDE.md) for the
checklist to follow when changing something.

### How scanning works

1. A scan is written to a queue on the phone (the _outbox_), then sent. The
   person waits a moment with "Checking…" on screen; a send that takes longer
   than a few seconds counts as no connection.
2. If the server answers, that answer is shown: green to admit, amber for a
   repeat, red to refuse. It is the truth.
3. If the server cannot be reached (or is already known to be out of reach), the
   phone judges the scan itself from its saved copy of the roster, using the
   same rules, marks the answer "offline", and keeps the scan queued. It is
   sent, in order, when the connection returns.
4. Anything the server later refuses (say, a student revoked in the meantime) is
   listed on the scanner until dismissed. Nothing is dropped silently.

Undo goes through the same queue, so it is applied after the scan it corrects.
If that scan is still only on the phone, it is simply taken back instead. Only
one tab or window of the app sends the queue at a time.

## Deploying on Replit

See [`replit.md`](replit.md). In short: two artifacts (web at `/`, API at
`/api`), a Postgres database, and one secret, `SESSION_SECRET`. Database
migrations apply themselves when the API starts (Replit also copies the
development database's structure to production when you publish; the API skips
the steps that copy already did and finishes the rest).

Replit keeps **two databases**: Development (the workspace's) and Production
(what the published site reads). No accounts exist at first. After the first
publish, the owner creates the super admin and loads the data **in Production**
with SQL: follow "First-time setup" in
[`docs/admin-sql.md`](docs/admin-sql.md).

## Privacy

The student page is open to anyone who knows an ID (a deliberate, accepted
trade-off: no login for students). It shows a name, major when available, and
attendance, and is
rate limited. Staff phones keep a copy of the student list so they can scan
offline; signing out wipes it (and needs a connection, so a shared phone can be
handed over only when it can reach the server). A session that merely expires
keeps the copy and the unsent scans, so nothing is lost when someone signs in
again.

## The CSV export

The report's CSV has fixed English column names, includes the major, and opens
in Excel with Arabic names intact. Excel drops leading zeros and shortens very long numbers in the
`student_id` column: if your IDs look like that, import the file with the ID
column set to Text (Data > From Text/CSV).
