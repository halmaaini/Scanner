/**
 * The one rule for which database a test may wipe. Tests never use
 * DATABASE_URL: they use TEST_DATABASE_URL, and only when the database's name
 * says it is a scratch one. A Replit app has a single database, so pointing
 * TEST_DATABASE_URL at it by mistake is refused instead of wiped.
 *
 * Kept free of the database client on purpose: `@workspace/db` connects the
 * moment it is imported, and a test has to choose (and vet) its database first.
 */
const SCRATCH_DATABASE_NAME = /test/i;

/** Throws unless `url` names a database that tests may wipe. */
export function assertScratchDatabase(url: string): void {
  let name: string;
  try {
    name = decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
  } catch {
    throw new Error("TEST_DATABASE_URL is not a valid database URL.");
  }
  if (!SCRATCH_DATABASE_NAME.test(name)) {
    throw new Error(
      `Refusing to use the database "${name}" for tests: they wipe it, so its name must contain "test" (for example scanner_test).`,
    );
  }
}

/**
 * Points this process at the test database (DATABASE_URL becomes
 * TEST_DATABASE_URL) and returns its URL, or undefined when no test database is
 * configured, in which case the database suites skip themselves. Call it before
 * anything imports `@workspace/db`.
 */
export function selectTestDatabase(): string | undefined {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return undefined;
  assertScratchDatabase(url);
  process.env.DATABASE_URL = url;
  return url;
}
