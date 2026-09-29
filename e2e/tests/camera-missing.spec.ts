import { browserArgs } from "../support/env";
import { expect, signIn, test } from "../support";

// A phone (or computer) with no camera at all. The browser is started without a
// fake camera and the page is told plainly that none exists, so the result does
// not depend on what the machine running the tests happens to have.
test.use({
  launchOptions: browserArgs(undefined, "missing"),
  permissions: [],
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(
        new DOMException("Requested device not found", "NotFoundError"),
      );
  });
});

test("says no camera was found, and offers the typed ID", async ({ page }) => {
  await signIn(page, "sara");
  await expect(page.getByText(/No camera found/)).toBeVisible();
  await expect(page.getByLabel("Student ID")).toBeVisible();
});
