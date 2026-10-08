import {
  expect,
  registrationOf,
  sql,
  test,
  waitForSavedCopy,
} from "../support";

test.describe("the student's card", () => {
  test("opens from the ID and shows the QR and which events were attended", async ({
    page,
  }) => {
    await page.goto("/card");
    await page.getByLabel("Student ID").fill("1001");
    await page.getByRole("button", { name: "Show my card" }).click();

    await expect(page).toHaveURL(/\/card\/1001$/);
    await expect(
      page.getByRole("heading", { name: "Layla Hassan" }),
    ).toBeVisible();
    await expect(page.getByText("Student ID 1001")).toBeVisible();
    await expect(
      page.getByRole("img", { name: "QR code for student 1001" }),
    ).toBeVisible();

    const rehearsal = page
      .getByRole("listitem")
      .filter({ hasText: "Rehearsal" });
    await expect(rehearsal).toContainText("Done");
    await expect(
      page.getByRole("listitem").filter({ hasText: "Graduation ceremony" }),
    ).toContainText("Pending");
    await expect(
      page.getByRole("listitem").filter({ hasText: "Trophy handover" }),
    ).toContainText("Not yet attended");
  });

  test("lists only the events the student is registered for", async ({
    page,
  }) => {
    await page.goto("/card/1006");
    await expect(
      page.getByRole("heading", { name: "Mariam Khalil" }),
    ).toBeVisible();
    await expect(page.getByRole("listitem")).toHaveCount(2);
    await expect(page.getByText("Trophy handover")).toHaveCount(0);
  });

  test("shows a fresh result after Refresh once the student has been scanned", async ({
    page,
  }) => {
    await page.goto("/card/1007");
    await expect(
      page.getByRole("listitem").filter({ hasText: "Rehearsal" }),
    ).toContainText("Pending");

    const sara = (
      await sql<{ id: number }>("select id from staff where username = 'sara'")
    )[0]!.id;
    await sql(
      "update registrations set checked_in_at = now(), checked_in_by = $1 where student_id = '1007' and event_id = 'rehearsal'",
      [sara],
    );
    expect(await registrationOf("1007", "rehearsal")).toMatchObject({
      by: "Sara",
    });

    await page.getByRole("button", { name: "Refresh" }).click();
    await expect(
      page.getByRole("listitem").filter({ hasText: "Rehearsal" }),
    ).toContainText("Done");
  });

  test("tells a revoked student to see the desk instead of showing a QR", async ({
    page,
  }) => {
    await page.goto("/card/1003");
    await expect(
      page.getByRole("heading", { name: "Karim Nasser" }),
    ).toBeVisible();
    await expect(page.getByRole("alert")).toHaveText(
      "Your access has been revoked. Please contact the registration desk.",
    );
    await expect(page.getByRole("img", { name: /QR code/ })).toHaveCount(0);
  });

  test("says when the ID is not found", async ({ page }) => {
    await page.goto("/card");
    await page.getByLabel("Student ID").fill("999999");
    await page.getByRole("button", { name: "Show my card" }).click();
    await expect(
      page.getByRole("heading", { name: "We couldn't find that ID" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Back" }).click();
    await expect(page).toHaveURL(/\/card$/);
  });

  test("accepts an ID typed with Arabic digits", async ({ page }) => {
    await page.goto("/card");
    await page.getByLabel("Student ID").fill("١٠٠١");
    await page.getByRole("button", { name: "Show my card" }).click();
    await expect(
      page.getByRole("heading", { name: "Layla Hassan" }),
    ).toBeVisible();
  });

  test("can be reopened with no connection after it has been seen once", async ({
    page,
    context,
  }) => {
    await page.goto("/card/1001");
    await expect(
      page.getByRole("heading", { name: "Layla Hassan" }),
    ).toBeVisible();
    await waitForSavedCopy(page, "/api/cards/1001");
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Layla Hassan" }),
    ).toBeVisible();

    await context.setOffline(true);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Layla Hassan" }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", { name: "QR code for student 1001" }),
    ).toBeVisible();
  });

  test("shows the seat in words and on the hall plan", async ({ page }) => {
    await page.goto("/card/1001");
    await expect(
      page.getByRole("heading", { name: "Your seat" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "You are on the Stage Right side, seat 7 of 9 in the row.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("group", { name: "Your seat in the hall" }),
    ).toBeVisible();
  });

  test("says when the seat has not been assigned yet", async ({ page }) => {
    await page.goto("/card/1009");
    await expect(
      page.getByText("Your seat has not been assigned yet."),
    ).toBeVisible();
  });

  test("shows who sits next to the student and plays the procession", async ({
    page,
  }) => {
    await sql(
      "update students set seat_row = 'F', seat_number = 8 where student_id = '1009'",
    );
    await page.goto("/card/1001");
    await expect(page.getByText("Sami Aziz")).toBeVisible();
    await expect(page.getByText("Empty seat")).toBeVisible();
    await expect(
      page.getByText("You walk in 4th of 4 in the Stage Right line."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Watch the procession" }).click();
    await expect(
      page.getByRole("img", {
        name: "The graduates walking in and taking their seats",
      }),
    ).toBeVisible();
    const forward = page.getByRole("button", { name: "Forward 5 s" });
    while (await forward.isVisible()) await forward.click();
    // At the end: the views to look round, and a replay.
    await expect(
      page.getByRole("button", { name: "Whole hall" }),
    ).toBeVisible();
    await expect(page.getByText("0:22 / 0:22")).toBeVisible();
    await page.getByRole("button", { name: "Replay" }).click();
    await expect(forward).toBeVisible();
  });
});
