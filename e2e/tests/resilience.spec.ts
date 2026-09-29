import type { Page } from "@playwright/test";
import {
  countLine,
  expect,
  fillSignIn,
  registrationOf,
  scanById,
  signIn,
  sql,
  test,
} from "../support";

const allSaved = (page: Page) => page.getByText("Nothing waiting to sync");

test.describe("a slow or failing server", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, "sara");
    await expect(countLine(page)).toHaveText("5 of 9 checked in");
  });

  test("says it is checking while the server is slow, and does not take a second ID meanwhile", async ({
    page,
  }) => {
    await page.route("**/api/scans", async (route) => {
      await new Promise((done) => setTimeout(done, 1_500));
      await route.continue();
    });

    await scanById(page, "1007");

    await expect(page.getByText("Checking…")).toBeVisible();
    // Read-only, not gone: a second ID cannot be typed in over the first.
    await expect(page.getByLabel("Student ID")).toHaveAttribute("readonly", "");
    await expect(
      page.getByRole("dialog").getByRole("heading", { name: "Checked in" }),
    ).toBeVisible();
  });

  test("does not make every scan wait when the server hangs", async ({
    page,
  }) => {
    await page.route("**/api/scans", () => {
      // Never answers.
    });

    // The first scan waits for the timeout, then shows what the saved list says.
    await scanById(page, "1007");
    const result = page.getByRole("dialog");
    await expect(
      result.getByText(/^Offline: saved on this device/),
    ).toBeVisible({ timeout: 15_000 });
    await result.getByRole("button", { name: "Scan next" }).click();

    // From then on the server is known to be out of reach: answers are immediate.
    await scanById(page, "1009");
    await expect(
      result.getByText(/^Offline: saved on this device/),
    ).toBeVisible({ timeout: 2_000 });
    await result.getByRole("button", { name: "Scan next" }).click();
    await expect(countLine(page)).toHaveText("7 of 9 checked in");
  });

  test("sends you to sign in again when the session ends while online, keeping the scan", async ({
    page,
  }) => {
    await sql("delete from sessions");

    await scanById(page, "1007");
    await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });
    await expect(
      page.getByText("1 check-in is saved on this phone."),
    ).toBeVisible();

    await fillSignIn(page, "sara");
    await expect(allSaved(page)).toBeVisible({ timeout: 20_000 });
    expect(await registrationOf("1007", "rehearsal")).toMatchObject({
      by: "Sara",
    });
  });

  test("signs you out at once when the account is deactivated", async ({
    page,
  }) => {
    await sql("update staff set is_active = false where username = 'sara'");

    await scanById(page, "1007");

    await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });
    expect((await registrationOf("1007", "rehearsal"))?.checkedInAt).toBeNull();
  });
});

test.describe("too many wrong passwords", () => {
  // Its own address, so the block does not spill over into the other tests.
  test.use({ extraHTTPHeaders: { "X-Forwarded-For": "203.0.113.77" } });

  test("tells the person to wait", async ({ page }) => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const response = await page.request.post("/api/auth/login", {
        data: { username: "sara", password: "not-the-password" },
      });
      expect(response.status()).toBe(401);
    }

    await page.goto("/login");
    await fillSignIn(page, "sara");

    await expect(page.getByRole("alert")).toHaveText(
      "Too many attempts. Wait a few minutes and try again.",
    );
  });
});
