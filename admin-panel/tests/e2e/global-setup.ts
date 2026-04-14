import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function globalSetup() {
  const useExisting = String(process.env.PLAYWRIGHT_USE_EXISTING_BACKEND ?? "true").toLowerCase() === "true";
  if (useExisting) return;

  // Intentionally no local DB/API bootstrap here for Rahul local runs.
  // If you want an auto-bootstrapped local stack, wire it separately in CI with required deps.
  throw new Error(
    [
      "PLAYWRIGHT_USE_EXISTING_BACKEND=false is not supported in this repo by default.",
      "Start your backend/API + DB externally and run with PLAYWRIGHT_USE_EXISTING_BACKEND=true.",
    ].join(" "),
  );
}
