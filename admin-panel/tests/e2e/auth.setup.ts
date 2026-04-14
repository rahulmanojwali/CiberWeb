import { test as setup, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME || "phase1_admin_in";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "Test@1234";
const COUNTRY = process.env.E2E_COUNTRY || "IN";

setup("authenticate", async ({ page }) => {
  fs.mkdirSync(path.join("tests", "e2e", ".auth"), { recursive: true });
  await page.goto("/login");

  await page.getByLabel("Username").fill(ADMIN_USERNAME);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);

  // Country select (default is IN, but keep explicit).
  await page.getByLabel("Country").click();
  await page.getByRole("option", { name: COUNTRY }).click();

  await page.getByRole("button", { name: /login/i }).click();

  await expect(page).not.toHaveURL(/\/login$/);
  await page.context().storageState({ path: "tests/e2e/.auth/admin.json" });
});
