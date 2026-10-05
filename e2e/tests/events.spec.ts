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

  test("saves when and where, which then shows on the student's card", async ({
    page,
  }) => {
    await page
      .getByRole("button", { name: "Details for Graduation ceremony" })
      .click();
    await page.getByLabel("Starts").fill("2026-06-12T09:30");
    await page.getByLabel("Venue").fill("Main hall");
    await page.getByLabel("Map link").fill("https://maps.example.com/hall");
    await page.getByRole("button", { name: "Save details" }).click();
    await expect(page.getByText("Saved")).toBeVisible();

    expect(
      await sql("select venue, map_url from events where id = 'graduation'"),
    ).toEqual([
      { venue: "Main hall", map_url: "https://maps.example.com/hall" },
    ]);

    await page.goto("/card/1001");
    await expect(page.getByText("Main hall")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open map" })).toHaveAttribute(
      "href",
      "https://maps.example.com/hall",
    );

    // The QR can be shown much larger, on plain white.
    await page.getByRole("button", { name: "Show a bigger QR" }).click();
    await expect(
      page.getByRole("dialog", { name: "Large QR code" }),
    ).toBeVisible();
  });
});
