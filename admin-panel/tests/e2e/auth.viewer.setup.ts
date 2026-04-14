import { test as setup, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const VIEWER_USERNAME = process.env.E2E_VIEWER_USERNAME || "phase1_org_viewer";
const VIEWER_PASSWORD = process.env.E2E_VIEWER_PASSWORD || "Test@1234";
const COUNTRY = process.env.E2E_COUNTRY || "IN";

setup("authenticate viewer", async ({ page }) => {
  fs.mkdirSync(path.join("tests", "e2e", ".auth"), { recursive: true });
  await page.goto("/login");

  await page.getByLabel("Username").fill(VIEWER_USERNAME);
  await page.getByLabel("Password").fill(VIEWER_PASSWORD);

  await page.getByLabel("Country").click();
  await page.getByRole("option", { name: COUNTRY }).click();

  await page.getByRole("button", { name: /login/i }).click();

  await expect(page).not.toHaveURL(/\/login$/);
  await page.context().storageState({ path: "tests/e2e/.auth/viewer.json" });
});
