import { afterEach, describe, expect, it } from "vitest";
import { assertScratchDatabase, selectTestDatabase } from "./test-database";

const original = {
  test: process.env.TEST_DATABASE_URL,
  database: process.env.DATABASE_URL,
};

afterEach(() => {
  for (const [key, value] of [
    ["TEST_DATABASE_URL", original.test],
    ["DATABASE_URL", original.database],
  ] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("assertScratchDatabase", () => {
  it("accepts a database whose name says it is for tests", () => {
    expect(() =>
      assertScratchDatabase("postgres://u:p@localhost:5432/scanner_test"),
    ).not.toThrow();
    expect(() =>
      assertScratchDatabase("postgres://u:p@host/TEST?sslmode=require"),
    ).not.toThrow();
  });

  it("refuses a database that could be the real one", () => {
    expect(() =>
      assertScratchDatabase("postgres://u:p@helium/heliumdb?sslmode=disable"),
    ).toThrow(/must contain "test"/);
    expect(() => assertScratchDatabase("postgres://u:p@localhost/")).toThrow(
      /must contain "test"/,
    );
  });

  it("refuses something that is not a URL", () => {
    expect(() => assertScratchDatabase("not a url")).toThrow(/valid database/);
  });
});

describe("selectTestDatabase", () => {
  it("does nothing when no test database is configured", () => {
    delete process.env.TEST_DATABASE_URL;
    process.env.DATABASE_URL = "postgres://u:p@localhost/real";
    expect(selectTestDatabase()).toBeUndefined();
    expect(process.env.DATABASE_URL).toBe("postgres://u:p@localhost/real");
  });

  it("points DATABASE_URL at the test database", () => {
    process.env.TEST_DATABASE_URL = "postgres://u:p@localhost/scanner_test";
    expect(selectTestDatabase()).toBe("postgres://u:p@localhost/scanner_test");
    expect(process.env.DATABASE_URL).toBe(
      "postgres://u:p@localhost/scanner_test",
    );
  });

  it("leaves DATABASE_URL alone when the test database is not a scratch one", () => {
    process.env.TEST_DATABASE_URL = "postgres://u:p@localhost/heliumdb";
    process.env.DATABASE_URL = "postgres://u:p@localhost/heliumdb";
    expect(() => selectTestDatabase()).toThrow(/must contain "test"/);
  });
});
