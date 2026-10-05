import { readFileSync } from "node:fs";
import { expect, registrationOf, signIn, sql, test } from "../support";

test.describe("the report", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, "boss");
    await page.getByRole("link", { name: "Report" }).click();
    await expect(
      page.getByRole("heading", { name: "Attendance" }),
    ).toBeVisible();
  });

  test("shows progress per event", async ({ page }) => {
    const rehearsal = page.getByRole("progressbar", { name: "Rehearsal" });
    await expect(rehearsal).toHaveAttribute("aria-valuenow", "5");
    await expect(rehearsal).toHaveAttribute("aria-valuemax", "9");
    await expect(page.getByText("5 / 9")).toBeVisible();
    await expect(page.getByText("0 / 9")).toBeVisible();
    await expect(page.getByText("0 / 3")).toBeVisible();
  });

  test("lists everyone on an event, with a filter for who has checked in", async ({
    page,
  }) => {
    const row = (name: string) =>
      page.getByRole("listitem").filter({ hasText: name });

    // Rehearsal is first: five of the ten are in, one is revoked and not in.
    await expect(row("Layla Hassan")).toContainText("Checked in");
    await expect(row("Layla Hassan")).toContainText("by Sara");
    await expect(row("Omar Haddad")).toContainText("Not yet");
    await expect(page.getByText("10 students")).toBeVisible();

    await page.getByRole("button", { name: "Not yet" }).click();
    await expect(row("Layla Hassan")).toHaveCount(0);
    await expect(row("Omar Haddad")).toBeVisible();
    await expect(page.getByText("5 students")).toBeVisible();

    await page.getByRole("button", { name: "Checked in" }).click();
    await expect(row("Layla Hassan")).toBeVisible();
    await expect(row("Omar Haddad")).toHaveCount(0);
  });

  test("finds a student by part of the ID or the name, and by Arabic spelling", async ({
    page,
  }) => {
    const box = page.getByLabel("Find a student");

    await box.fill("layla");
    await expect(page.getByText("1 student", { exact: true })).toBeVisible();

    await box.fill("007");
    await expect(
      page.getByRole("listitem").filter({ hasText: "Omar Haddad" }),
    ).toBeVisible();

    await box.fill("1003");
    await expect(
      page.getByRole("listitem").filter({ hasText: "Karim Nasser" }),
    ).toContainText("Access revoked");

    // Alef with hamza typed as a plain alef still finds the name.
    await box.fill("احمد");
    await expect(page.getByText("أحمد الفاطمي")).toBeVisible();

    await box.fill("zzzz");
    await expect(page.getByText("No students match.")).toBeVisible();
  });

  test("offers no check-in on a closed event", async ({ page }) => {
    await sql("update events set is_open = false where id = 'rehearsal'");
    await page.getByLabel("Find a student").fill("1007");
    await expect(
      page.getByRole("listitem").filter({ hasText: "Omar Haddad" }),
    ).toContainText("Closed");
    await expect(
      page.getByRole("button", { name: "Check in Omar Haddad" }),
    ).toHaveCount(0);
  });

  test("checks a student in from the list", async ({ page }) => {
    await page.getByLabel("Find a student").fill("1007");
    await page.getByRole("button", { name: "Check in Omar Haddad" }).click();

    const row = page.getByRole("listitem").filter({ hasText: "Omar Haddad" });
    await expect(row).toContainText("Checked in");
    await expect(row).toContainText("by Hala");
    expect(await registrationOf("1007", "rehearsal")).toMatchObject({
      by: "Hala",
    });
  });

  test("exports a CSV that opens correctly in a spreadsheet", async ({
    page,
  }) => {
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export CSV" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(
      /^attendance-\d{4}-\d{2}-\d{2}\.csv$/,
    );

    const text = readFileSync((await download.path())!, "utf8");
    expect(
      text.startsWith(
        "\ufeffstudent_id,name,major,event,attended,checked_in_at,checked_in_at_utc,checked_in_by,access\r\n",
      ),
    ).toBe(true);
    expect(text).toContain("1001,Layla Hassan,,Rehearsal,yes,");
    expect(text).toContain(",Sara,active");
    expect(text).toContain(
      "1003,Karim Nasser,,Graduation ceremony,no,,,,revoked",
    );
    expect(text).toContain("أحمد الفاطمي");
    // Nine students on two events plus three on the trophy list, and the revoked one on two.
    expect(text.trim().split("\r\n")).toHaveLength(1 + 10 * 2 + 3);
  });
});

test.describe("an admin", () => {
  test("can open the report too", async ({ page }) => {
    await signIn(page, "omar");
    await page.getByRole("link", { name: "Report" }).click();
    await expect(
      page.getByRole("heading", { name: "Attendance" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Events" })).toHaveCount(0);
  });
});
