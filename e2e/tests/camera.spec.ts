import { browserArgs, qrVideoPath } from "../support/env";
import { expect, registrationOf, signIn, test } from "../support";

// The browser's fake camera plays a video of student 1007's QR code.
test.use({ launchOptions: browserArgs(qrVideoPath("1007")) });

test("reads a QR code from the camera, and keeps reading after 'Scan next'", async ({
  page,
}) => {
  await signIn(page, "sara");

  const result = page.getByRole("dialog");
  await expect(result.getByRole("heading", { name: "Checked in" })).toBeVisible(
    { timeout: 25_000 },
  );
  await expect(result.getByText("Omar Haddad")).toBeVisible();
  expect(await registrationOf("1007", "rehearsal")).toMatchObject({
    by: "Sara",
  });

  // The same QR is still in front of the camera: reading resumes and it is a repeat.
  await result.getByRole("button", { name: "Scan next" }).click();
  await expect(
    result.getByRole("heading", { name: "Already checked in" }),
  ).toBeVisible({ timeout: 15_000 });
});
