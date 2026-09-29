import { expect, test as base, type Page } from "@playwright/test";
// The one list of where the app keeps things in the browser.
import { STORAGE_KEYS } from "../../artifacts/web/src/config";
import { closeDatabase, registrationOf, resetDemoData, sql } from "./db";

export { expect, registrationOf, sql, STORAGE_KEYS };

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

const DEMO_PASSWORDS = {
  sara: "sara-demo-pw",
  omar: "omar-demo-pw",
  boss: "boss-demo-pw",
} as const;

type DemoUser = keyof typeof DEMO_PASSWORDS;

/** Fills in the sign-in form that is already on screen, and submits it. */
export async function fillSignIn(page: Page, username: DemoUser) {
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(DEMO_PASSWORDS[username]);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Signs in through the login page and waits for the scanner. */
export async function signIn(page: Page, username: DemoUser) {
  await page.goto("/login");
  await fillSignIn(page, username);
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

/**
 * Waits until the phone has kept its own copy of a server answer (`what` is
 * its URL, e.g. "/api/roster"): the service worker has taken over the app
 * shell, and the saved copy, which is written a moment after the answer
 * arrives, holds it. Only then does a reload with no connection still work.
 */
export async function waitForSavedCopy(page: Page, what: string) {
  await page.evaluate(() =>
    navigator.serviceWorker.ready.then(() => undefined),
  );
  await page.waitForFunction(
    ([key, url]) => localStorage.getItem(key!)?.includes(url!) ?? false,
    [STORAGE_KEYS.queryCache, what],
  );
}
