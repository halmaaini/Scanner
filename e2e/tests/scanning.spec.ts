import {
  countLine,
  expect,
  registrationOf,
  scanById,
  signIn,
  sql,
  test,
} from "../support";

test.describe("scanning by typing an ID", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, "sara");
  });

  test("checks a student in, updates the count and records who did it", async ({
    page,
  }) => {
    await expect(countLine(page)).toHaveText("5 of 9 checked in");

    await scanById(page, "1007");

    const result = page.getByRole("dialog");
    await expect(
      result.getByRole("heading", { name: "Checked in" }),
    ).toBeVisible();
    await expect(result.getByText("Omar Haddad")).toBeVisible();
    await expect(result.getByText("Student ID 1007")).toBeVisible();
    await expect(result.getByText("Rehearsal")).toBeVisible();

    await result.getByRole("button", { name: "Scan next" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(countLine(page)).toHaveText("6 of 9 checked in");
    expect(await registrationOf("1007", "rehearsal")).toMatchObject({
      by: "Sara",
    });
  });

  test("reports a repeat scan and says who scanned first", async ({ page }) => {
    // Layla was checked in to the rehearsal by Sara in the demo data.
    await scanById(page, "1001");

    const result = page.getByRole("dialog");
    await expect(
      result.getByRole("heading", { name: "Already checked in" }),
    ).toBeVisible();
    await expect(
      result.getByText("Not counted twice. Nothing was changed."),
    ).toBeVisible();
    await expect(result.getByText("Scanned by")).toBeVisible();
    await expect(result.getByText("Sara", { exact: true })).toBeVisible();
    // Nothing to undo here: this scan did not check anyone in.
    await expect(
      result.getByRole("button", { name: "Undo check-in" }),
    ).toHaveCount(0);
  });

  test("turns away a revoked student, an unknown ID and someone not on the list", async ({
    page,
  }) => {
    const result = page.getByRole("dialog");

    await scanById(page, "1003");
    await expect(
      result.getByRole("heading", { name: "Not allowed" }),
    ).toBeVisible();
    await expect(result.getByText("Access revoked")).toBeVisible();
    await result.getByRole("button", { name: "Scan next" }).click();

    await scanById(page, "9999");
    await expect(
      result.getByRole("heading", { name: "ID not found" }),
    ).toBeVisible();
    await expect(result.getByText("Student ID 9999")).toBeVisible();
    await result.getByRole("button", { name: "Scan next" }).click();

    // Only three students are on the trophy list, and the event is closed until opened.
    await sql("update events set is_open = true where id = 'trophy'");
    await page.reload();
    await page.getByLabel("Event").selectOption({ label: "Trophy handover" });
    await scanById(page, "1006");
    await expect(
      result.getByRole("heading", { name: "Not on the list" }),
    ).toBeVisible();
    await expect(
      result.getByText("Not registered for this event"),
    ).toBeVisible();
    await result.getByRole("button", { name: "Scan next" }).click();

    // None of these were recorded.
    expect((await registrationOf("1003", "rehearsal"))?.checkedInAt).toBeNull();
    expect(await registrationOf("1006", "trophy")).toBeUndefined();
  });

  test("understands IDs typed with Arabic digits and stray spaces", async ({
    page,
  }) => {
    await scanById(page, " ١٠٠٧ ");
    const result = page.getByRole("dialog");
    await expect(
      result.getByRole("heading", { name: "Checked in" }),
    ).toBeVisible();
    await expect(result.getByText("Student ID 1007")).toBeVisible();
  });

  test("can undo the check-in it just made", async ({ page }) => {
    await scanById(page, "1007");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Undo check-in" })
      .click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByText("Check-in undone for Omar Haddad."),
    ).toBeVisible();
    await expect(countLine(page)).toHaveText("5 of 9 checked in");
    expect((await registrationOf("1007", "rehearsal"))?.checkedInAt).toBeNull();
  });

  test("remembers the chosen event and offers only open ones", async ({
    page,
  }) => {
    const events = page.getByLabel("Event");
    await expect(events.locator("option")).toHaveText([
      "Rehearsal",
      "Graduation ceremony",
    ]);

    await events.selectOption({ label: "Graduation ceremony" });
    await expect(countLine(page)).toHaveText("0 of 9 checked in");

    await page.reload();
    await expect(events).toHaveValue("graduation");
  });

  test("says so when no event is open", async ({ page }) => {
    await sql("update events set is_open = false");
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "No open events" }),
    ).toBeVisible();
  });

  test("shows a check-in made on another device after a moment", async ({
    page,
  }) => {
    await expect(countLine(page)).toHaveText("5 of 9 checked in");
    const omar = (
      await sql<{ id: number }>("select id from staff where username = 'omar'")
    )[0]!.id;
    await sql(
      "update registrations set checked_in_at = now(), checked_in_by = $1 where student_id = '1008' and event_id = 'rehearsal'",
      [omar],
    );
    // The scanner re-reads the list every 30 seconds and whenever the page comes back to the front.
    await page.evaluate(() =>
      window.dispatchEvent(new Event("visibilitychange")),
    );
    await expect(countLine(page)).toHaveText("6 of 9 checked in");

    await scanById(page, "1008");
    await expect(
      page
        .getByRole("dialog")
        .getByRole("heading", { name: "Already checked in" }),
    ).toBeVisible();
    await expect(
      page.getByRole("dialog").getByText("Omar", { exact: true }),
    ).toBeVisible();
  });
});
