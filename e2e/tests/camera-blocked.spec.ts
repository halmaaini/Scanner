import { browserArgs } from "../support/env";
import { expect, scanById, signIn, test } from "../support";

// There is a camera, but the person has said no to it.
test.use({
  launchOptions: browserArgs(undefined, "blocked"),
  permissions: [],
});

test("says the camera is blocked, and typing an ID still works", async ({
  page,
}) => {
  await signIn(page, "sara");
  await expect(page.getByText(/Camera access is blocked/)).toBeVisible();

  await scanById(page, "1007");
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "Checked in" }),
  ).toBeVisible();
});

test("shows that it is checking while a typed ID waits on a slow server", async ({
  page,
}) => {
  await signIn(page, "sara");
  await expect(page.getByText(/Camera access is blocked/)).toBeVisible();
  await page.route("**/api/scans", async (route) => {
    await new Promise((done) => setTimeout(done, 1_500));
    await route.continue();
  });

  await scanById(page, "1007");

  // No camera picture to show it on: the button says so.
  await expect(page.getByRole("button", { name: "Checking…" })).toBeVisible();
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "Checked in" }),
  ).toBeVisible();
});
