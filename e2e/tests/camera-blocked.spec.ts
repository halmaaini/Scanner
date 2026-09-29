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
