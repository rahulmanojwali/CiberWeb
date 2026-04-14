import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function globalTeardown() {
  const useExisting = String(process.env.PLAYWRIGHT_USE_EXISTING_BACKEND ?? "true").toLowerCase() === "true";
  if (useExisting) return;
  // No-op: we do not manage backend lifecycle from Playwright in local mode.
}
