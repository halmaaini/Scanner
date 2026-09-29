import { readFileSync } from "node:fs";
import path from "node:path";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import { describe, expect, it } from "vitest";
import * as schema from "./schema";

const migrationsFolder = path.resolve(import.meta.dirname, "../migrations");
const read = (file: string) =>
  JSON.parse(readFileSync(path.join(migrationsFolder, file), "utf8"));

/** The snapshot drizzle-kit wrote with the latest migration, and the SQL that would bring it up to the schema code. */
async function pendingStatements(tamper?: (snapshot: any) => void) {
  const { entries } = read("meta/_journal.json") as {
    entries: { tag: string }[];
  };
  const latest = entries.at(-1)!.tag.split("_")[0];
  const snapshot = read(`meta/${latest}_snapshot.json`);
  tamper?.(snapshot);
  return generateMigration(snapshot, generateDrizzleJson(schema, snapshot.id));
}

// Needs no database: compares the schema code with the last snapshot.
describe("migrations", () => {
  it("cover every change in the schema code", async () => {
    // Failing? You changed lib/db/src/schema: run `pnpm --filter @workspace/db run generate`.
    expect(await pendingStatements()).toEqual([]);
  });

  it("would notice a change (so the check above means something)", async () => {
    const statements = await pendingStatements((snapshot) => {
      delete snapshot.tables["public.students"].checkConstraints
        .students_full_name_check;
    });
    expect(statements.join("\n")).toMatch(/students_full_name_check/);
  });
});
