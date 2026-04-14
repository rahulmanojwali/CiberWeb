import { test, expect } from "@playwright/test";

const TOKEN_CODE = process.env.E2E_TOKEN_FINAL || "GT_PHASE1_FINAL_00001";
const LOT_CODE = process.env.E2E_LOT_FINAL_CODE || "LOT_GT_PHASE1_FINAL_00001_1";

test("lots: finalized lot blocks weight edit", async ({ page }) => {
  await page.goto("/lots");

  await page.getByLabel("Token Code").fill(TOKEN_CODE);
  await page.getByRole("button", { name: "Refresh" }).click();

  await page.getByRole("cell", { name: LOT_CODE }).click();
  await expect(page.getByRole("dialog", { name: "Lot Details" })).toBeVisible();

  const editBtn = page.getByRole("button", { name: "Edit Weight" });
  await expect(editBtn).toBeVisible();
  await expect(editBtn).toBeDisabled();

  await expect(page.getByText(/Weight edit blocked/i)).toBeVisible();
});
