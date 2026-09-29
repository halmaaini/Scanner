import { expect, registrationOf, sql, test } from "../support";

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
    await page.evaluate(() =>
      navigator.serviceWorker.ready.then(() => undefined),
    );
    await page.waitForFunction(
      () => localStorage.getItem("scanner.cache") !== null,
    );
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
});
