import { readFileSync } from "node:fs";
import path from "node:path";
import { type MigrationMeta, readMigrationFiles } from "drizzle-orm/migrator";
import { NodePgSession } from "drizzle-orm/node-postgres";
import { PgDialect } from "drizzle-orm/pg-core";
import type { Pool, PoolClient } from "pg";
import { pool } from "./client";

/**
 * Where drizzle records which migrations have run. These are its defaults,
 * spelled out because this file reads that table.
 */
export const MIGRATIONS_SCHEMA = "drizzle";
const MIGRATIONS_TABLE = "__drizzle_migrations";

/**
 * Extensions the database must have. `pgcrypto` hashes staff passwords
 * (`crypt`, `gen_salt`), so accounts are created and reset with plain SQL. It
 * is a "trusted" extension: the database owner may create it. Created here,
 * not by a migration, so it is there even when the tables came from elsewhere.
 */
const REQUIRED_EXTENSIONS = ["pgcrypto"] as const;

/** Postgres error codes that say "that already exists": a table or index, a constraint, a column. */
const ALREADY_EXISTS = new Set(["42P07", "42710", "42701"]);

export type MigrationOutcome =
  /** Nothing was waiting. */
  | "up-to-date"
  /** The waiting migrations ran (steps whose result was already there were skipped). */
  | "migrated"
  /** Every step's result was already there (see below), so the migrations were only recorded. */
  | "adopted";

export interface MigrationResult {
  outcome: MigrationOutcome;
  /** The steps that were skipped because the database already had their result. */
  alreadyInPlace: string[];
}

type Executor = Pick<Pool, "query">;

/**
 * Brings the database up to date with the migrations in `migrationsFolder`.
 *
 * Safe to call on every start and from several instances at once: a Postgres
 * advisory lock makes the others wait until the first one has finished, after
 * which they find nothing left to do. Needs no TTY, unlike `drizzle-kit push`.
 *
 * Replit copies the structure of the development database to production when
 * the app is published, so tables, columns or indexes a waiting migration
 * would create may be there before it runs. A step that fails only because its
 * result already exists is skipped; every other step runs, so whatever the copy
 * left out is still created and an in-place change (a new check, a default) is
 * never lost. Afterwards the schema must match the latest migration or nothing
 * is kept. Steps that only *remove* something are not covered: if the copy
 * already removed it, that step fails loudly. Migrations are structure only;
 * change data with SQL.
 */
export async function runMigrations(
  migrationsFolder: string,
): Promise<MigrationResult> {
  const client = await pool.connect();
  try {
    await client.query(
      "select pg_advisory_lock(hashtext('scanner-migrations'))",
    );
    for (const extension of REQUIRED_EXTENSIONS) {
      await client.query(`create extension if not exists "${extension}"`);
    }

    const pending = await pendingMigrations(
      client,
      readMigrationFiles({ migrationsFolder }),
    );
    if (pending.length === 0)
      return { outcome: "up-to-date", alreadyInPlace: [] };

    const alreadyInPlace = await applyMigrations(
      client,
      pending,
      migrationsFolder,
    );
    await recordMigrations(client, pending, migrationsFolder);

    const steps = pending.reduce((count, { sql }) => count + sql.length, 0);
    return {
      outcome: alreadyInPlace.length < steps ? "migrated" : "adopted",
      alreadyInPlace,
    };
  } finally {
    try {
      await client.query(
        "select pg_advisory_unlock(hashtext('scanner-migrations'))",
      );
    } finally {
      client.release();
    }
  }
}

/** The migrations newer than the last one recorded: the rule drizzle's own migrator uses. */
async function pendingMigrations(
  client: PoolClient,
  migrations: MigrationMeta[],
): Promise<MigrationMeta[]> {
  const journal = `"${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}"`;
  const { rows: found } = await client.query<{ present: boolean }>(
    "select to_regclass($1) is not null as present",
    [journal],
  );
  if (!found[0]?.present) return migrations;

  const { rows } = await client.query<{ last: string | null }>(
    `select max(created_at) as last from ${journal}`,
  );
  const last = rows[0]?.last;
  return migrations.filter(
    (migration) => last == null || Number(last) < migration.folderMillis,
  );
}

/**
 * Runs the steps in one transaction, so a failure leaves nothing half done,
 * and returns the steps that were already in place.
 */
async function applyMigrations(
  client: PoolClient,
  pending: MigrationMeta[],
  migrationsFolder: string,
): Promise<string[]> {
  const alreadyInPlace: string[] = [];
  await client.query("begin");
  try {
    for (const { sql } of pending) {
      for (const step of sql) {
        // Without a savepoint one failed step would spoil the whole transaction.
        await client.query("savepoint step");
        try {
          await client.query(step);
        } catch (error) {
          if (!isAlreadyThere(error)) throw error;
          await client.query("rollback to savepoint step");
          alreadyInPlace.push(headline(step));
        }
      }
    }

    const { missing } = await checkSchema(client, migrationsFolder);
    if (missing.length > 0) {
      throw new Error(
        `The database already has part of the schema, and the migrations cannot complete it. Missing: ${missing.join(", ")}`,
      );
    }
    await client.query("commit");
  } catch (error) {
    // The connection may be what failed; the original error is the one to report.
    await client.query("rollback").catch(() => undefined);
    throw error;
  }
  return alreadyInPlace;
}

/**
 * Marks migrations as applied through drizzle's own bookkeeping: its migrator,
 * handed the same migrations with nothing left to run.
 */
async function recordMigrations(
  client: PoolClient,
  migrations: MigrationMeta[],
  migrationsFolder: string,
): Promise<void> {
  const dialect = new PgDialect();
  await dialect.migrate(
    migrations.map((migration) => ({ ...migration, sql: [] })),
    new NodePgSession<Record<string, never>, Record<string, never>>(
      client,
      dialect,
      undefined,
    ),
    {
      migrationsFolder,
      migrationsSchema: MIGRATIONS_SCHEMA,
      migrationsTable: MIGRATIONS_TABLE,
    },
  );
}

function isAlreadyThere(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && ALREADY_EXISTS.has(code);
}

/** The first line of a step: enough to tell which one it was. */
function headline(step: string): string {
  const [firstLine = ""] = step.trim().split("\n");
  return firstLine.trim().slice(0, 100);
}

// ---- Is the schema complete? ------------------------------------------------

interface Snapshot {
  tables: Record<
    string,
    {
      name: string;
      columns: Record<string, { primaryKey: boolean }>;
      indexes: Record<string, unknown>;
      foreignKeys: Record<string, unknown>;
      compositePrimaryKeys: Record<string, unknown>;
      uniqueConstraints: Record<string, unknown>;
      checkConstraints: Record<string, unknown>;
    }
  >;
}

const label = (kind: string, table: string, name?: string) =>
  name ? `${kind} ${table}.${name}` : `${kind} ${table}`;

/**
 * Everything the latest migration leaves behind, by name, read from the
 * snapshot drizzle-kit wrote next to it (so it always matches the schema code).
 */
function expectedObjects(migrationsFolder: string): string[] {
  const read = (file: string) =>
    JSON.parse(readFileSync(path.join(migrationsFolder, file), "utf8"));
  const { entries } = read("meta/_journal.json") as {
    entries: { tag: string }[];
  };
  const latest = entries.at(-1);
  if (!latest) return [];
  const prefix = latest.tag.split("_")[0];
  const { tables } = read(`meta/${prefix}_snapshot.json`) as Snapshot;

  return Object.values(tables).flatMap((table) => {
    const columns = Object.entries(table.columns);
    const hasPrimaryKey =
      columns.some(([, column]) => column.primaryKey) ||
      Object.keys(table.compositePrimaryKeys).length > 0;
    return [
      label("table", table.name),
      ...columns.map(([name]) => label("column", table.name, name)),
      ...(hasPrimaryKey ? [label("primary key of", table.name)] : []),
      ...Object.keys(table.indexes).map((name) =>
        label("index", table.name, name),
      ),
      ...[
        ...Object.keys(table.foreignKeys),
        ...Object.keys(table.uniqueConstraints),
        ...Object.keys(table.checkConstraints),
      ].map((name) => label("constraint", table.name, name)),
    ];
  });
}

const LIVE_OBJECTS = `
  select 'table' as kind, c.relname as parent, null as name
    from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
  union all
  select 'column', c.relname, a.attname
    from pg_attribute a join pg_class c on c.oid = a.attrelid
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
      and a.attnum > 0 and not a.attisdropped
  union all
  select case when k.contype = 'p' then 'primary key of' else 'constraint' end,
         c.relname,
         case when k.contype = 'p' then null else k.conname end
    from pg_constraint k join pg_class c on c.oid = k.conrelid
    where c.relnamespace = 'public'::regnamespace and k.contype in ('p', 'f', 'u', 'c')
  union all
  select 'index', tablename, indexname from pg_indexes where schemaname = 'public'`;

/**
 * What the latest migration should have created (`expected`) and which of it
 * the database lacks (`missing`). Only presence by name is checked: enough to
 * tell a finished schema from one that is missing pieces.
 */
export async function checkSchema(
  executor: Executor,
  migrationsFolder: string,
): Promise<{ expected: string[]; missing: string[] }> {
  const { rows } = await executor.query<{
    kind: string;
    parent: string;
    name: string | null;
  }>(LIVE_OBJECTS);
  const live = new Set(
    rows.map((row) => label(row.kind, row.parent, row.name ?? undefined)),
  );
  const expected = expectedObjects(migrationsFolder);
  return { expected, missing: expected.filter((object) => !live.has(object)) };
}
