import { expect, signIn, sql, test } from "../support";

test.describe("the events page", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, "boss");
    await page.getByRole("link", { name: "Events" }).click();
    await expect(page.getByRole("heading", { name: "Events" })).toBeVisible();
  });

  test("closes and reopens an event, and scanners follow", async ({ page }) => {
    const graduation = page.getByRole("switch", {
      name: "Graduation ceremony: open for scanning",
    });
    await expect(graduation).toBeChecked();

    await graduation.click();
    await expect(graduation).not.toBeChecked();
    expect(
      await sql("select is_open from events where id = 'graduation'"),
    ).toEqual([{ is_open: false }]);

    // The scanner now offers only the rehearsal.
    await page.getByRole("link", { name: "Scanner" }).click();
    await expect(
      page
        .getByLabel("Event")
        .getByRole("option", { name: "Graduation ceremony" }),
    ).toHaveCount(0);

    await page.getByRole("link", { name: "Events" }).click();
    await page
      .getByRole("switch", { name: "Trophy handover: open for scanning" })
      .click();
    expect(await sql("select is_open from events where id = 'trophy'")).toEqual(
      [{ is_open: true }],
    );
  });
});
