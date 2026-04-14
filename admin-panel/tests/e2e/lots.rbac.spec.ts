import { test, expect } from "@playwright/test";

test("lots: viewer cannot see Create Lot CTA", async ({ page }) => {
  // For this spec, we rely on the same storageState; if you want a true viewer run,
  // set E2E_ADMIN_USERNAME=phase1_org_viewer and re-run auth.setup.
  await page.goto("/lots");
  await expect(page.getByRole("button", { name: /Create Lot/i })).toBeHidden();
});

