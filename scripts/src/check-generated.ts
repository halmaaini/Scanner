import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// `pnpm run check:generated`: regenerates the API validators and client from
// lib/api-spec/openapi.yaml and fails if that changed anything, meaning the
// spec (or orval's config) was edited without committing the generated code.
// The regenerated files are left in place so you can review and commit them.
const root = path.resolve(import.meta.dirname, "../..");
const generatedDirs = [
  "lib/api-zod/src/generated",
  "lib/api-client-react/src/generated",
];

/** Every generated file with a hash of its content. */
function snapshot(): Map<string, string> {
  const files = new Map<string, string>();
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else {
        files.set(
          path.relative(root, full),
          createHash("sha256").update(readFileSync(full)).digest("hex"),
        );
      }
    }
  };
  for (const dir of generatedDirs) visit(path.join(root, dir));
  return files;
}

const before = snapshot();
execFileSync("pnpm", ["--filter", "@workspace/api-spec", "run", "codegen"], {
  cwd: root,
  stdio: "inherit",
});
const after = snapshot();

const changed = [...new Set([...before.keys(), ...after.keys()])]
  .filter((file) => before.get(file) !== after.get(file))
  .sort();

if (changed.length > 0) {
  console.error(
    `\nThe generated API code was out of date. Regenerated (review and commit):\n${changed.map((f) => `  ${f}`).join("\n")}`,
  );
  process.exit(1);
}
console.log("\nGenerated API code is up to date.");
