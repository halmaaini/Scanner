import {
  STORAGE_KEYS,
  expect,
  registrationOf,
  scanById,
  signIn,
  test,
  waitForSavedCopy,
} from "../support";

test.describe("signing in", () => {
  test("rejects a wrong password and stays on the sign-in page", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill("sara");
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("alert")).toHaveText(
      "Wrong username or password.",
    );
    await expect(page).toHaveURL(/\/login$/);
  });

  test("opens the scanner for an admin, and signing out closes it again", async ({
    page,
  }) => {
    await signIn(page, "sara");
    await expect(page.getByText("Sara (admin)")).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/scan");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("sends signed-out visitors to the sign-in page, and the root to the student page", async ({
    page,
  }) => {
    await page.goto("/report");
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/");
    await expect(page).toHaveURL(/\/card$/);
  });

  test("keeps admins out of the report but lets the super admin in", async ({
    page,
  }) => {
    await signIn(page, "omar");
    await expect(page.getByRole("link", { name: "Report" })).toHaveCount(0);
    await page.goto("/report");
    await expect(page).toHaveURL(/\/scan$/);
    await page.getByRole("button", { name: "Sign out" }).click();

    await signIn(page, "boss");
    await expect(page.getByText("Hala (super admin)")).toBeVisible();
    await page.getByRole("link", { name: "Report" }).click();
    await expect(
      page.getByRole("heading", { name: "Attendance" }),
    ).toBeVisible();
  });

  test("wipes what the phone saved when signing out: no student list, no unsent changes", async ({
    page,
  }) => {
    await signIn(page, "sara");
    await waitForSavedCopy(page, "/api/roster");
    // A scan that cannot get through stays waiting on the phone.
    await page.route("**/api/scans", (route) => route.abort());
    await scanById(page, "1007");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Scan next" })
      .click();

    const stored = (key: string) =>
      page.evaluate((k) => localStorage.getItem(k) ?? "", key);
    // Sanity: the phone holds the names, and the waiting scan, right now.
    expect(await stored(STORAGE_KEYS.queryCache)).toContain("Layla Hassan");
    expect(await stored(STORAGE_KEYS.outbox)).toContain("1007");

    // It warns first that something has not been sent.
    const warnings: string[] = [];
    page.once("dialog", (dialog) => {
      warnings.push(dialog.message());
      void dialog.accept();
    });
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(warnings).toHaveLength(1);

    // The saved copy is rewritten a moment after the change.
    await expect
      .poll(() => stored(STORAGE_KEYS.queryCache))
      .not.toContain("Layla Hassan");
    expect(await stored(STORAGE_KEYS.queryCache)).not.toContain("/api/roster");
    expect(await stored(STORAGE_KEYS.outbox)).toBe("");
    expect((await registrationOf("1007", "rehearsal"))?.checkedInAt).toBeNull();
  });
});
