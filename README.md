# Attendance

Check people in at events by scanning their QR code or typing their student ID.
Built first for a graduation (rehearsal, ceremony, trophy handover) and kept
general enough to reuse.

- **Admins** scan at the door. It works with a weak or missing connection: scans
  are saved on the phone and sent when the signal returns.
- **One super admin** also gets an attendance report with CSV export.
- **Attendees** open a public page, type their student ID, and see their card
  (with the QR code) and which events they have attended.
- **Everything else is SQL**: importing students, revoking and renewing,
  opening events, creating admins. See [`docs/admin-sql.md`](docs/admin-sql.md).

## Try it locally

You need Node 22+, pnpm, and PostgreSQL 16.

```bash
pnpm install
cp .env.example .env            # then export it: set -a; source .env; set +a

# terminal 1: the API (applies database migrations when it starts)
pnpm --filter @workspace/api-server run dev

# load demo data once (development databases only!)
pnpm --filter @workspace/scripts run sql lib/db/sql/seed-demo.sql

# terminal 2: the web app (proxies /api to port 8080)
PORT=5173 pnpm --filter @workspace/web run dev
```

Open http://localhost:5173. Sign in as `sara / sara-demo-pw` (admin) or
`boss / boss-demo-pw` (super admin). The student page is `/card`; try ID `1001`.
The camera needs HTTPS or `localhost`; without a camera, type the ID instead.

## Tests

```bash
pnpm run typecheck        # types for every package (also builds the shared libs)
pnpm test                 # unit tests; database and API tests run when TEST_DATABASE_URL is set
pnpm --filter @workspace/e2e test:e2e   # real browser, real API, real database
```

`TEST_DATABASE_URL` must be a scratch Postgres database: the tests **wipe** it,
and refuse to touch anything else. The browser tests also need Chromium
(`CHROMIUM_PATH=/path/to/chrome` if Playwright has not downloaded one).

## How it is organised

A pnpm workspace, laid out the way Replit's TypeScript template expects.

```
artifacts/api-server   Express 5 API. Thin routes, logic in services/.
artifacts/web          React + Vite + Tailwind PWA (installable, works offline).
lib/db                 Database schema (Drizzle), SQL migrations, demo data.
lib/api-spec           openapi.yaml: the API contract.
lib/api-zod            Generated from the contract: request/response validation.
lib/api-client-react   Generated from the contract: typed client and hooks.
lib/attendance         Rules shared by server and web (scan judging, IDs, roles).
e2e                    Browser tests.
scripts                Run a .sql file; Replit post-merge hook.
docs                   The admin SQL cookbook.
```

### One source of truth for each thing

Each fact is defined in exactly one place; everything else is generated from it
or reads it. To change a fact, change it there.

| What                  | Defined in                                             | Used by                                                       |
| --------------------- | ------------------------------------------------------ | ------------------------------------------------------------- |
| Database shape        | `lib/db/src/schema` (migrations are generated from it) | all server queries; the SQL cookbook is tested against it     |
| API contract          | `lib/api-spec/openapi.yaml`                            | server validation and web client, both generated              |
| Who can be admitted   | `lib/attendance` `evaluateScan`                        | the server, and the scanner's offline mode                    |
| Student ID cleaning   | `lib/attendance` `normalizeStudentId`                  | server and web                                                |
| Roles and permissions | `lib/attendance` `can` / `canUndoCheckIn`              | server checks and web menus                                   |
| What the app knows    | `GET /api/roster`                                      | scanner, report, counts, CSV and the offline copy all read it |
| Counting attendance   | `web/src/domain/summary.ts`                            | scanner header and report                                     |
| Every write           | the outbox (`web/src/offline`)                         | scans and undos take the same path                            |
| All wording           | `web/src/messages.ts`                                  | every screen                                                  |
| Colours and fonts     | `web/src/index.css`                                    | every screen                                                  |

New screens and reports should be a new _view of the roster_ (a function in
`web/src/domain`), not a new endpoint. See [`CLAUDE.md`](CLAUDE.md) for the
checklist to follow when changing something.

### How scanning works

1. A scan is written to a queue on the phone (the _outbox_), then sent.
2. If the server answers, that answer is shown: green to admit, amber for a
   repeat, red to refuse. It is the truth.
3. If the server cannot be reached, the phone judges the scan itself from its
   saved copy of the roster, using the same rules, marks the answer "offline",
   and keeps the scan queued. It is sent, in order, when the connection returns.
4. Anything the server later refuses (say, a student revoked in the meantime) is
   listed on the scanner until dismissed. Nothing is dropped silently.

Undo goes through the same queue, so it is applied after the scan it corrects
even if that scan has not reached the server yet.

## Deploying on Replit

See [`replit.md`](replit.md). In short: two artifacts (web at `/`, API at
`/api`), a Postgres database, and one secret, `SESSION_SECRET`. Database
migrations apply themselves when the API starts. No accounts exist at first;
create the super admin with SQL (see the cookbook).

## Privacy

The student page is open to anyone who knows an ID (a deliberate, accepted
trade-off: no login for students). It shows a name and attendance only, and is
rate limited. Staff phones keep a copy of the student list so they can scan
offline; signing out wipes it.
