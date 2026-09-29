import { readFileSync } from "node:fs";
import path from "node:path";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { Pool, PoolClient } from "pg";
import { pool } from "./client";

/**
 * Where drizzle records which migrations have run. These are its defaults,
 * spelled out because this file reads and writes that table as well.
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

export type MigrationOutcome =
  /** Nothing was waiting. */
  | "up-to-date"
  /** The waiting migrations ran. */
  | "migrated"
  /** The tables were already there (see below), so the migrations were only recorded. */
  | "adopted";

type Executor = Pick<Pool, "query">;
type Migration = ReturnType<typeof readMigrationFiles>[number];

/**
 * Brings the database up to date with the migrations in `migrationsFolder`.
 *
 * Safe to call on every start and from several instances at once: a Postgres
 * advisory lock makes the others wait until the first one has finished, after
 * which they find nothing left to do. Needs no TTY, unlike `drizzle-kit push`.
 *
 * Replit copies the structure of the development database to production when
 * the app is published, so a brand-new production database can already hold
 * every table while this record is still empty. Running the migrations then
 * would fail on "already exists". When everything the latest migration
 * describes is already present, they are recorded as applied instead.
 * Migrations are therefore structure only; change data with SQL.
 */
export async function runMigrations(
  migrationsFolder: string,
): Promise<MigrationOutcome> {
  const client = await pool.connect();
  try {
    await client.query(
      "select pg_advisory_lock(hashtext('scanner-migrations'))",
    );
    for (const extension of REQUIRED_EXTENSIONS) {
      await client.query(`create extension if not exists "${extension}"`);
    }

    const pending = await pendingMigrations(client, migrationsFolder);
    if (pending.length === 0) return "up-to-date";

    const { expected, missing } = await checkSchema(client, migrationsFolder);
    if (missing.length === 0) {
      await recordMigrations(client, pending);
      return "adopted";
    }

    try {
      await migrate(drizzle(client), {
        migrationsFolder,
        migrationsSchema: MIGRATIONS_SCHEMA,
        migrationsTable: MIGRATIONS_TABLE,
      });
    } catch (error) {
      if (missing.length === expected.length) throw error;
      // Some of the schema exists and some does not: creating it again cannot work.
      throw new Error(
        `The database already has part of the schema, so the migrations cannot create the rest. Missing: ${missing.join(", ")}`,
        { cause: error },
      );
    }
    return "migrated";
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

/** The migrations drizzle has not recorded yet (it applies those newer than the last one recorded). */
async function pendingMigrations(
  client: PoolClient,
  migrationsFolder: string,
): Promise<Migration[]> {
  const migrations = readMigrationFiles({ migrationsFolder });
  await client.query(`create schema if not exists "${MIGRATIONS_SCHEMA}"`);
  await client.query(
    `create table if not exists "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" (id serial primary key, hash text not null, created_at bigint)`,
  );
  const { rows } = await client.query<{ created_at: string | null }>(
    `select created_at from "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" order by created_at desc limit 1`,
  );
  const last = rows[0]?.created_at;
  return migrations.filter(
    (migration) => last == null || Number(last) < migration.folderMillis,
  );
}

/** Marks migrations as applied without running them, exactly as drizzle would after running them. */
async function recordMigrations(
  client: PoolClient,
  migrations: Migration[],
): Promise<void> {
  await client.query("begin");
  try {
    for (const migration of migrations) {
      await client.query(
        `insert into "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" ("hash", "created_at") values ($1, $2)`,
        [migration.hash, migration.folderMillis],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

// ---- Does the database already have the schema? -----------------------------

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
 * tell "the migrations ran here" from "nothing is here" or "half of it is".
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
