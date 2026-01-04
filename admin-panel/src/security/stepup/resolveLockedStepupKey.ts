import { canonicalizeResourceKey } from "../../utils/adminUiConfig";

/**
 * Resolve a Step-Up lock key even when the UI hands us a sibling key.
 *
 * Problem:
 * - Policies may lock `*.menu` while API/resource checks use `*.list` (or vice versa).
 * - Route/menu guards that only check the incoming key can miss the lock.
 * - Result: the screen renders and protected API calls get blocked repeatedly.
 */
export function resolveLockedStepupKey(
  rawKey: string | null | undefined,
  isLocked: (key: string) => boolean,
): string | null {
  const key = canonicalizeResourceKey(rawKey);
  if (!key) return null;

  // Direct match
  if (isLocked(key)) return key;

  // Try common sibling keys for the same screen.
  const suffixes = [
    ".menu",
    ".list",
    ".view",
    ".detail",
    ".create",
    ".edit",
    ".deactivate",
  ] as const;

  const hitSuffix = suffixes.find((s) => key.endsWith(s));
  if (!hitSuffix) return null;

  const base = key.slice(0, key.length - hitSuffix.length);

  // Prefer `menu` first so navigation-level locks win; then common screen keys.
  const candidates = [
    `${base}.menu`,
    `${base}.list`,
    `${base}.view`,
    `${base}.detail`,
    `${base}.create`,
    `${base}.edit`,
    `${base}.deactivate`,
  ];

  for (const candidate of candidates) {
    const normalized = canonicalizeResourceKey(candidate);
    if (normalized && isLocked(normalized)) return normalized;
  }

  return null;
}
