import { test, expect } from "@playwright/test";

const TOKEN_CODE = process.env.E2E_TOKEN_EDITABLE || "GT_PHASE1_EDITABLE_00001";
const LOT_CODE = process.env.E2E_LOT_EDITABLE_CODE || "LOT_GT_PHASE1_EDITABLE_00001_1";

test("lots: edit weight requires reason and updates timeline", async ({ page }) => {
  await page.goto("/lots");

  await page.getByLabel("Token Code").fill(TOKEN_CODE);
  await page.getByRole("button", { name: "Refresh" }).click();

  // Click the lot row to open detail dialog.
  await page.getByRole("cell", { name: LOT_CODE }).click();
  await expect(page.getByRole("dialog", { name: "Lot Details" })).toBeVisible();

  await page.getByRole("button", { name: "Edit Weight" }).click();
  await expect(page.getByRole("dialog", { name: "Edit Lot Weight" })).toBeVisible();

  await page.getByLabel("New Total Weight (kg)").fill("25");

  // Missing reason should show UI validation.
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Reason is required.")).toBeVisible();

  await page.getByLabel("Reason").fill("Correction after re-weigh");
  await page.getByRole("button", { name: "Save" }).click();

  // Weight dialog closes and detail refreshes.
  await expect(page.getByRole("dialog", { name: "Edit Lot Weight" })).toBeHidden();

  // Timeline should include the reason text.
  await expect(page.getByText("Reason: Correction after re-weigh")).toBeVisible();
});
