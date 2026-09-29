import { browserArgs } from "../support/env";
import { expect, signIn, test } from "../support";

// A phone (or computer) with no camera at all.
test.use({
  launchOptions: browserArgs(undefined, "missing"),
  permissions: [],
});

test("says no camera was found, and offers the typed ID", async ({ page }) => {
  await signIn(page, "sara");
  await expect(page.getByText(/No camera found/)).toBeVisible();
  await expect(page.getByLabel("Student ID")).toBeVisible();
});
