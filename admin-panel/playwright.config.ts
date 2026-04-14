import { defineConfig } from "@playwright/test";

const WEB_PORT = Number(process.env.PLAYWRIGHT_WEB_PORT || process.env.E2E_WEB_PORT || 4173);
const WEB_BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.E2E_WEB_BASE_URL ||
  `http://127.0.0.1:${WEB_PORT}`;
const API_BASE_URL =
  process.env.PLAYWRIGHT_API_BASE_URL ||
  process.env.E2E_API_BASE_URL ||
  "http://127.0.0.1:3311/api";

const REUSE_WEB_SERVER =
  String(process.env.PLAYWRIGHT_REUSE_WEB_SERVER ?? "true").toLowerCase() ===
  "true";
const USE_EXISTING_BACKEND =
  String(process.env.PLAYWRIGHT_USE_EXISTING_BACKEND ?? "true").toLowerCase() ===
  "true";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: WEB_BASE_URL,
    trace: "retain-on-failure",
  },
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  ...(REUSE_WEB_SERVER
    ? {}
    : {
        webServer: {
          // Prefer preview for determinism in CI; dev is fine for local.
          // Use Vite directly (avoid Refine devtools binding) and keep the port configurable.
          command: `node ./node_modules/vite/bin/vite.js dev --host 127.0.0.1 --port ${WEB_PORT} --mode test`,
          url: `${WEB_BASE_URL}/login`,
          reuseExistingServer: false,
          timeout: 120_000,
          env: {
            ...process.env,
            VITE_API_BASE_URL: API_BASE_URL,
          },
        },
      }),
  projects: [
    {
      name: "setup-admin",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "setup-viewer",
      testMatch: /auth\.viewer\.setup\.ts/,
    },
    {
      name: "chromium-admin",
      dependencies: ["setup-admin"],
      use: {
        storageState: "tests/e2e/.auth/admin.json",
      },
    },
    {
      name: "chromium-viewer",
      dependencies: ["setup-viewer"],
      testMatch: /lots\.rbac\.spec\.ts/,
      use: {
        storageState: "tests/e2e/.auth/viewer.json",
      },
    },
  ],
  // Light guardrail: make missing API base explicit in "existing backend" mode.
  // (Frontend must be started with VITE_API_BASE_URL set, or already baked into build.)
  metadata: {
    useExistingBackend: USE_EXISTING_BACKEND,
    apiBaseUrl: API_BASE_URL,
  },
});
