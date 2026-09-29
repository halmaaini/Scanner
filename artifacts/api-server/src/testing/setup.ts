// Runs before every test file. The app imports @workspace/db, which reads
// DATABASE_URL the moment it is first imported, so the scratch database has to
// be selected before anything else loads.
//
//   TEST_DATABASE_URL=postgres://user:pass@localhost:5432/scanner_test \
//     pnpm --filter @workspace/api-server test
//
// Without TEST_DATABASE_URL the database suites skip themselves; DATABASE_URL
// is never used for tests, so a real database cannot be wiped by accident.
const testUrl = process.env.TEST_DATABASE_URL;

if (testUrl) {
  process.env.DATABASE_URL = testUrl;
} else {
  process.env.DATABASE_URL = "postgres://unused:unused@127.0.0.1:1/unused";
  console.warn(
    "TEST_DATABASE_URL is not set: the API integration tests are being skipped.",
  );
}
