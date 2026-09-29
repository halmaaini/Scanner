import type { Page } from "@playwright/test";
import {
  countLine,
  expect,
  registrationOf,
  scanById,
  signIn,
  sql,
  test,
} from "../support";

const waiting = (page: Page, n: number) =>
  page.getByText(`${n} waiting to sync`);
const allSaved = (page: Page) => page.getByText("Nothing waiting to sync");

test.describe("with no connection", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, "sara");
    await expect(countLine(page)).toHaveText("5 of 9 checked in");
  });

  test("saves scans and sends them when the connection returns", async ({
    page,
    context,
  }) => {
    await context.setOffline(true);
    await expect(page.getByText("Offline", { exact: true })).toBeVisible();

    await scanById(page, "1007");
    const result = page.getByRole("dialog");
    await expect(
      result.getByRole("heading", { name: "Checked in" }),
    ).toBeVisible();
    await expect(
      result.getByText(/^Offline: saved on this device/),
    ).toBeVisible();
    await result.getByRole("button", { name: "Scan next" }).click();

    // Counted at once, waiting to be sent, and not on the server yet.
    await expect(countLine(page)).toHaveText("6 of 9 checked in");
    await expect(waiting(page, 1)).toBeVisible();
    expect((await registrationOf("1007", "rehearsal"))?.checkedInAt).toBeNull();

    await context.setOffline(false);
    await expect(allSaved(page)).toBeVisible({ timeout: 20_000 });
    expect(await registrationOf("1007", "rehearsal")).toMatchObject({
      by: "Sara",
    });
    await expect(countLine(page)).toHaveText("6 of 9 checked in");
  });

  test("spots a repeat scan made while offline", async ({ page, context }) => {
    await context.setOffline(true);
    await scanById(page, "1007");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Scan next" })
      .click();

    await scanById(page, "1007");
    const result = page.getByRole("dialog");
    await expect(
      result.getByRole("heading", { name: "Already checked in" }),
    ).toBeVisible();
    await expect(
      result.getByText(/^Offline: checked against the saved list/),
    ).toBeVisible();
    await result.getByRole("button", { name: "Scan next" }).click();

    // Only the first scan is queued.
    await expect(waiting(page, 1)).toBeVisible();
  });

  test("turns away a revoked student using the saved list", async ({
    page,
    context,
  }) => {
    await context.setOffline(true);
    await scanById(page, "1003");
    const result = page.getByRole("dialog");
    await expect(
      result.getByRole("heading", { name: "Not allowed" }),
    ).toBeVisible();
    await expect(
      result.getByText(/^Offline: checked against the saved list/),
    ).toBeVisible();
    await result.getByRole("button", { name: "Scan next" }).click();
    await expect(allSaved(page)).toBeVisible();
  });

  test("undoes a saved scan before it ever reaches the server", async ({
    page,
    context,
  }) => {
    await context.setOffline(true);
    await scanById(page, "1007");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Undo check-in" })
      .click();
    await expect(
      page.getByText("Undo saved. It syncs when you're back online."),
    ).toBeVisible();
    await expect(countLine(page)).toHaveText("5 of 9 checked in");
    await expect(waiting(page, 2)).toBeVisible();

    await context.setOffline(false);
    await expect(allSaved(page)).toBeVisible({ timeout: 20_000 });
    expect((await registrationOf("1007", "rehearsal"))?.checkedInAt).toBeNull();
    await expect(countLine(page)).toHaveText("5 of 9 checked in");
  });

  test("tells you when the server refuses a scan it saved", async ({
    page,
    context,
  }) => {
    await context.setOffline(true);
    await scanById(page, "1008");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Scan next" })
      .click();

    // Meanwhile the student's access is revoked.
    await sql(
      "update students set is_active = false where student_id = '1008'",
    );
    await context.setOffline(false);

    const banner = page.getByRole("region", { name: /couldn't be saved/ });
    await expect(banner).toBeVisible({ timeout: 20_000 });
    await expect(banner).toContainText("فاطمة الزهراء");
    await expect(banner).toContainText("Access revoked");
    expect((await registrationOf("1008", "rehearsal"))?.checkedInAt).toBeNull();

    await banner.getByRole("button", { name: "Dismiss" }).click();
    await expect(banner).toHaveCount(0);
  });

  test("asks you to sign in again when the session ends, keeping saved scans", async ({
    page,
    context,
  }) => {
    await context.setOffline(true);
    await scanById(page, "1007");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Scan next" })
      .click();

    // The session ends while the scan is still only on the phone.
    await sql("delete from sessions");
    await context.setOffline(false);
    await expect(page).toHaveURL(/\/login$/, { timeout: 20_000 });

    await page.getByLabel("Username").fill("sara");
    await page.getByLabel("Password").fill("sara-demo-pw");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(allSaved(page)).toBeVisible({ timeout: 20_000 });
    expect(await registrationOf("1007", "rehearsal")).toMatchObject({
      by: "Sara",
    });
  });

  test("sends saved scans only under the admin who made them", async ({
    page,
    context,
  }) => {
    await context.setOffline(true);
    await scanById(page, "1007");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Scan next" })
      .click();
    await sql("delete from sessions");
    await context.setOffline(false);
    await expect(page).toHaveURL(/\/login$/, { timeout: 20_000 });

    // Omar picks up the phone. Sara's scan stays hers to send.
    await page.getByLabel("Username").fill("omar");
    await page.getByLabel("Password").fill("omar-demo-pw");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(
      page.getByText(/1 change from another admin is waiting on this phone/),
    ).toBeVisible();
    await page.waitForTimeout(1500);
    expect((await registrationOf("1007", "rehearsal"))?.checkedInAt).toBeNull();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel("Username").fill("sara");
    await page.getByLabel("Password").fill("sara-demo-pw");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(allSaved(page)).toBeVisible({ timeout: 20_000 });
    expect(await registrationOf("1007", "rehearsal")).toMatchObject({
      by: "Sara",
    });
  });

  test("warns before signing out with scans that have not been sent", async ({
    page,
    context,
  }) => {
    await context.setOffline(true);
    await scanById(page, "1007");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Scan next" })
      .click();

    const messages: string[] = [];
    page.once("dialog", (dialog) => {
      messages.push(dialog.message());
      void dialog.dismiss();
    });
    await page.getByRole("button", { name: "Sign out" }).click();

    await expect.poll(() => messages.length).toBe(1);
    expect(messages[0]).toContain("1 change hasn't been sent yet");
    await expect(page).toHaveURL(/\/scan$/);
    await expect(waiting(page, 1)).toBeVisible();
  });

  test("reopens after a reload with no connection and keeps scanning", async ({
    page,
    context,
  }) => {
    // Let the service worker take over and the saved copy be written.
    await page.evaluate(() =>
      navigator.serviceWorker.ready.then(() => undefined),
    );
    await page.waitForFunction(
      () => localStorage.getItem("scanner.cache") !== null,
    );
    await page.reload();
    await expect(countLine(page)).toHaveText("5 of 9 checked in");

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByText("Sara (admin)")).toBeVisible();
    await expect(countLine(page)).toHaveText("5 of 9 checked in");

    await scanById(page, "1009");
    await expect(
      page.getByRole("dialog").getByRole("heading", { name: "Checked in" }),
    ).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Scan next" })
      .click();
    await expect(countLine(page)).toHaveText("6 of 9 checked in");

    await context.setOffline(false);
    await expect(allSaved(page)).toBeVisible({ timeout: 20_000 });
    expect(await registrationOf("1009", "rehearsal")).toMatchObject({
      by: "Sara",
    });
  });

  test("keeps saved scans across a reload and sends them later", async ({
    page,
    context,
  }) => {
    await page.evaluate(() =>
      navigator.serviceWorker.ready.then(() => undefined),
    );
    await page.waitForFunction(
      () => localStorage.getItem("scanner.cache") !== null,
    );
    await page.reload();
    await expect(countLine(page)).toBeVisible();

    await context.setOffline(true);
    await scanById(page, "1010");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Scan next" })
      .click();
    await page.reload();
    await expect(waiting(page, 1)).toBeVisible();
    await expect(countLine(page)).toHaveText("6 of 9 checked in");

    await context.setOffline(false);
    await expect(allSaved(page)).toBeVisible({ timeout: 20_000 });
    expect(await registrationOf("1010", "rehearsal")).toMatchObject({
      by: "Sara",
    });
  });
});
