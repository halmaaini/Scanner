import { readFileSync } from "node:fs";
import { expect, signIn, test } from "../support";

test.describe("the super admin's report", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, "boss");
    await page.getByRole("link", { name: "Report" }).click();
    await expect(
      page.getByRole("heading", { name: "Attendance" }),
    ).toBeVisible();
  });

  test("shows progress per event and the latest check-ins", async ({
    page,
  }) => {
    const rehearsal = page.getByRole("progressbar", { name: "Rehearsal" });
    await expect(rehearsal).toHaveAttribute("aria-valuenow", "5");
    await expect(rehearsal).toHaveAttribute("aria-valuemax", "9");
    await expect(page.getByText("5 / 9")).toBeVisible();
    await expect(page.getByText("0 / 9")).toBeVisible();
    await expect(page.getByText("0 / 3")).toBeVisible();

    const latest = page.getByRole("list").filter({ hasText: "Layla Hassan" });
    await expect(latest.getByRole("listitem")).toHaveCount(5);
    await expect(latest).toContainText("1001 · Rehearsal · Sara");
  });

  test("finds a student by name, ID or Arabic spelling and shows each event", async ({
    page,
  }) => {
    const box = page.getByLabel("Find a student");

    await box.fill("layla");
    const row = page.getByRole("listitem").filter({ hasText: "Layla Hassan" });
    await expect(row).toContainText("Rehearsal:");
    await expect(row).toContainText("Graduation ceremony: Not yet");
    await expect(row).toContainText("Trophy handover: Not yet");

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
        "\ufeffstudent_id,name,event,attended,checked_in_at,checked_in_at_utc,checked_in_by,access\r\n",
      ),
    ).toBe(true);
    expect(text).toContain("1001,Layla Hassan,Rehearsal,yes,");
    expect(text).toContain(",Sara,active");
    expect(text).toContain(
      "1003,Karim Nasser,Graduation ceremony,no,,,,revoked",
    );
    expect(text).toContain("أحمد الفاطمي");
    // Nine students on two events plus three on the trophy list, and the revoked one on two.
    expect(text.trim().split("\r\n")).toHaveLength(1 + 10 * 2 + 3);
  });
});
