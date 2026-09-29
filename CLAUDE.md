# CLAUDE.md

Two agents work on this repo and hand off through committed markdown: **Claude
Code** writes the code; the **Replit agent** runs and publishes it. Start with
`README.md` (what the app is, and the table of single sources of truth), then:

- `Claude Handoffs/README.md`: the loop · `HANDOFFS.md`: the round ledger
- `Replit Handoffs/`: Replit's per-round reports · `Replit Requests/`: its inbound briefs
- `docs/admin-sql.md`: how the owner operates the system (tested SQL)

**Follow the loop below. Do not skip the reviewer gate. If something needs a
decision that is the user's to make, stop and ask; do not decide for them.**

## The loop (every round)

1. **Start**: read the latest `Replit Handoffs/*.md` report, scan `Replit Requests/` for open (🆕) briefs, glance at `HANDOFFS.md`.
2. **Scope + mark started**: a round is one coherent batch. If scope is unclear, ask. Set the round's `HANDOFFS.md` status to `🚧 in progress (Claude)`.
3. **Implement** on the branch you were assigned (code only; see "Working agreement").
4. **Reviewer gate (mandatory)**: see below.
5. **Ship**: commit, push the assigned branch. Merge to `main` only when the user has said to.
6. **Hand off**: run `/handoff`: write `Claude Handoffs/NNN-slug.md` (commit hash, exact runtime steps, reviewer verdicts) and flip the ledger row to `📤 pending Replit`.
7. Give the user the paste-ready line for Replit: _read `Claude Handoffs/NNN-slug.md`_.
8. Keep Q&A in chat; only the two bookend docs per round are durable.

## Reviewer gate

After the work is written, spawn a **separate reviewer agent** (fresh context, not the author). For each change it checks: _does it resolve the root cause · no regressions · complete, not stubbed_, plus the **change checklist** below. It returns PASS/FAIL with a note; FAIL means fix and re-review. Record the verdicts in the handoff.

## Working agreement

- Claude makes **code** changes only. The Replit agent runs **runtime** steps (install, restart, publish) and works in the **development** database; it cannot write the published (Production) one. The owner does that with SQL (`docs/admin-sql.md`).
- **Never run `db push`/`drizzle-kit push`**: it needs a TTY and fails on Replit. Schema changes are versioned migrations that the API server applies when it starts.
- Every change keeps the single-source-of-truth rule: **define a fact once, derive the rest.** No second copy of a rule, a list of values, a calculation or an endpoint that says the same thing.

## Change checklist (what a change usually touches)

Work top to bottom and stop where the change no longer reaches.

1. **Data**: edit `lib/db/src/schema`, then `pnpm --filter @workspace/db run generate`, then read the new SQL in `lib/db/migrations`. Never edit an applied migration; add a new one. Migrations are **structure only** (Replit may already have created the structure in Production; data changes are SQL for the owner). Update `lib/db/sql/seed-demo.sql` if demo data needs it. A test fails if the schema changed without a migration.
2. **Contract**: edit `lib/api-spec/openapi.yaml` (descriptions are the API docs), then `pnpm --filter @workspace/api-spec run codegen` and commit the generated output; `pnpm run check:generated` proves it is current. Every server change that touches an endpoint updates the spec in the same change. Adding a staff role: the spec enum, then `STAFF_ROLES` in `lib/db` (a contract test compares them), then the grants in `lib/attendance`.
3. **Rules**: anything about _who may do or see what_, how an ID is read, or how a scan is judged goes in `lib/attendance` with tests. Both the server and the offline scanner use it. The database's student ID check is built from the ID rule there.
4. **Server**: a service in `artifacts/api-server/src/services` (queries, logic) and a thin route (parse with the generated schema, call the service, reply with `sendJson`). Add tests in the route's `*.test.ts`.
5. **Web**:
   - New numbers, lists or reports are a _view of the roster_: a pure function in `artifacts/web/src/domain` with a unit test. Do **not** add an endpoint for a new view; extend `GET /roster` only if the data truly is not there.
   - Every write is an operation in the outbox (`src/offline`), not a direct request.
   - Words go in `src/messages.ts`; colours in `src/index.css`; tunables in `src/config.ts`.
6. **Operations**: if the owner will run it by hand, add the SQL to `docs/admin-sql.md` (its blocks are executed by a test, so they cannot go stale).
7. **Docs**: `README.md` (the table of sources of truth) and `replit.md` if a command, env var or convention changes.
8. **Verify**: `pnpm run typecheck`, `pnpm test` and `pnpm --filter @workspace/e2e test:e2e` (both need `TEST_DATABASE_URL`, see README). Also run the app and look at the screen you changed.

## Conventions

- TypeScript, strict; `pnpm run typecheck` at the root builds the shared libs first (a package's own `typecheck` will complain until they are built).
- Generated code (`lib/api-zod`, `lib/api-client-react/src/generated`, `lib/db/migrations`) is committed and never hand-edited. Prettier ignores it. (`lib/api-client-react/src/custom-fetch.ts` is hand-written.)
- Format with `pnpm format`. Comments explain _why_, not what; no dead code, no half-finished features.
- Tests live next to the code (`*.test.ts`). The database and API tests are **skipped, with a warning**, unless `TEST_DATABASE_URL` is set (so say in a handoff whether they ran); they wipe that database, and refuse any whose name does not contain `test`.
- The scanner must keep working with no connection: a change to scanning or the roster needs an offline test in `e2e/tests/offline.spec.ts` or a unit test in `web/src/offline`.
- Plain, friendly wording in the UI. The prototype's look (ivory, navy, gold; green/amber/red results) is the design system.

## Gotchas (Replit runtime)

- Sessions live in the `sessions` table, created by a migration (`connect-pg-simple`'s own table creation does not work on Replit).
- Hosted Postgres drops idle connections; `lib/db/src/client.ts` handles the pool's `error` event so a drop cannot crash the server.
- The service worker (`sw.js`) must be served as JavaScript at the site root, not rewritten to `index.html`; `/api` is never cached by it.
- Replit copies the development database's structure to Production when publishing, before the API's first start there. `runMigrations` copes (it skips a step that fails only because its result already exists, runs the rest, and keeps nothing unless the schema then matches the latest migration); keep migrations structure-only and additive so that stays true (a step that only removes something the copy already removed is not covered).
- Behind Replit's proxy the API trusts `TRUST_PROXY_HOPS` proxies (default 1) for the client address and the HTTPS flag; check it after the first publish.
