import { expect, test as base, type Page } from "@playwright/test";
import { closeDatabase, registrationOf, resetDemoData, sql } from "./db";

export { expect, registrationOf, sql };

/**
 * Every test starts from the same demo data (lib/db/sql/seed-demo.sql):
 * ten students, events rehearsal + graduation open and trophy closed, and
 * five students already checked in to the rehearsal.
 */
export const test = base.extend<{ freshData: void }, { closeDb: void }>({
  freshData: [
    async ({}, use) => {
      await resetDemoData();
      await use();
    },
    { auto: true },
  ],
  // Once per worker, after its last test: release the database connection.
  closeDb: [
    async ({}, use) => {
      await use();
      await closeDatabase();
    },
    { scope: "worker", auto: true },
  ],
});

const DEMO_PASSWORDS: Record<string, string> = {
  sara: "sara-demo-pw",
  omar: "omar-demo-pw",
  boss: "boss-demo-pw",
};

/** Signs in through the login page and waits for the scanner. */
export async function signIn(page: Page, username: "sara" | "omar" | "boss") {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(DEMO_PASSWORDS[username]!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByLabel("Event")).toBeVisible();
}

/** Types an ID in the manual box and submits. */
export async function scanById(page: Page, studentId: string) {
  await page.getByLabel("Student ID").fill(studentId);
  await page.getByRole("button", { name: "Check in" }).click();
}

/** The count line under the event picker, e.g. "5 of 9 checked in". */
export const countLine = (page: Page) =>
  page.locator("p", { hasText: "checked in" }).first();
