import { getStepupPolicyScreens } from "../services/security/stepupPolicyService";
import { canonicalizeResourceKey } from "./adminUiConfig";

type StepupScreensResponse = any;

const RESPONSE_CANDIDATES = [
  (resp: StepupScreensResponse) => resp,
  (resp: StepupScreensResponse) => resp?.data,
  (resp: StepupScreensResponse) => resp?.response,
  (resp: StepupScreensResponse) => resp?.data?.data,
  (resp: StepupScreensResponse) => resp?.response?.data,
  (resp: StepupScreensResponse) => resp?.response?.response,
];

let lockedSet: Set<string> | null = null;
let loadingPromise: Promise<Set<string>> | null = null;

function normalizeKey(value: any): string {
  const key = canonicalizeResourceKey(String(value || "").trim());
  return key ? key : "";
}

function extractSelected(resp: StepupScreensResponse): string[] {
  for (const candidateGetter of RESPONSE_CANDIDATES) {
    const candidate = candidateGetter(resp);
    if (candidate && Array.isArray(candidate.selected)) {
      return candidate.selected
        .map((value: any) => normalizeKey(value))
        .filter(Boolean);
    }
  }
  return [];
}

// ✅ derive selected keys when "selected" is absent
function deriveSelectedFromScreens(resp: StepupScreensResponse): string[] {
  let best: any = null;

  for (const candidateGetter of RESPONSE_CANDIDATES) {
    const candidate = candidateGetter(resp);
    if (
      candidate &&
      typeof candidate === "object" &&
      (Array.isArray(candidate.screens) ||
        Array.isArray(candidate.locked_defaults) ||
        typeof candidate.match === "object")
    ) {
      best = candidate;
      break;
    }
    if (!best && candidate && typeof candidate === "object") {
      best = candidate;
    }
  }

  if (!best) return [];

  const screens: any[] = Array.isArray(best.screens) ? best.screens : [];

  const lockedDefaults: string[] = Array.isArray(best.locked_defaults)
    ? best.locked_defaults.map(normalizeKey).filter(Boolean)
    : [];

  const matchObj = typeof best.match === "object" ? best.match : {};
  const matchType: string = String(matchObj.type || "RESOURCE_KEY_PREFIX")
    .trim()
    .toUpperCase();

  const matchValues: string[] = Array.isArray(matchObj.values)
    ? matchObj.values.map(normalizeKey).filter(Boolean)
    : [];

  const derived: string[] = [];

  for (const screen of screens) {
    const screenKey: string = normalizeKey(screen?.resource_key);
    if (!screenKey) continue;

    let ok = false;

    if (matchType === "RESOURCE_KEY_PREFIX") {
      ok = matchValues.some((prefix: string) =>
        screenKey.startsWith(prefix),
      );
    } else {
      ok = matchValues.includes(screenKey);
    }

    if (ok) derived.push(screenKey);
  }

  return Array.from(new Set([...derived, ...lockedDefaults]));
}

export async function loadStepupLockedSetOnce(params: {
  username: string;
  language?: string;
  country?: string;
}) {
  if (lockedSet) {
    return lockedSet;
  }
  if (loadingPromise) {
    return loadingPromise;
  }

  console.log("[STEPUP_CACHE] fetching getStepupPolicyScreens");
  loadingPromise = getStepupPolicyScreens(params)
    .then((resp) => {
      let selected = extractSelected(resp);

      if (!selected.length) {
        selected = deriveSelectedFromScreens(resp);
      }

      lockedSet = new Set(selected);
      console.log("[STEPUP_CACHE] locked keys count =", lockedSet.size);
      return lockedSet;
    })
    .catch((err) => {
      lockedSet = new Set();
      throw err;
    })
    .finally(() => {
      loadingPromise = null;
    });

  return loadingPromise;
}

export function getStepupLockedSet() {
  return lockedSet || new Set();
}

export function clearStepupLockedSet() {
  lockedSet = null;
  loadingPromise = null;
}

// working fine with the superadmin role as on 04 jan 2026 at 3:05 pm 

// import { getStepupPolicyScreens } from "../services/security/stepupPolicyService";
// import { canonicalizeResourceKey } from "./adminUiConfig";

// type StepupScreensResponse = any;

// const RESPONSE_CANDIDATES = [
//   (resp: StepupScreensResponse) => resp,
//   (resp: StepupScreensResponse) => resp?.data,
//   (resp: StepupScreensResponse) => resp?.response,
//   (resp: StepupScreensResponse) => resp?.data?.data,
//   (resp: StepupScreensResponse) => resp?.response?.data,
//   (resp: StepupScreensResponse) => resp?.response?.response,
// ];

// let lockedSet: Set<string> | null = null;
// let loadingPromise: Promise<Set<string>> | null = null;

// function extractSelected(resp: StepupScreensResponse): string[] {
//   for (const candidateGetter of RESPONSE_CANDIDATES) {
//     const candidate = candidateGetter(resp);
//     if (candidate && Array.isArray(candidate.selected)) {
//       return candidate.selected
//         .map((value: any) => canonicalizeResourceKey(String(value || "").trim()))
//         .filter(Boolean);
//     }
//   }
//   return [];
// }

// export async function loadStepupLockedSetOnce(params: {
//   username: string;
//   language?: string;
//   country?: string;
// }) {
//   if (lockedSet) {
//     return lockedSet;
//   }
//   if (loadingPromise) {
//     return loadingPromise;
//   }

//   console.log("[STEPUP_CACHE] fetching getStepupPolicyScreens");
//   loadingPromise = getStepupPolicyScreens(params)
//     .then((resp) => {
//       const selected = extractSelected(resp);
//       lockedSet = new Set(selected);
//       return lockedSet;
//     })
//     .catch((err) => {
//       lockedSet = new Set();
//       throw err;
//     })
//     .finally(() => {
//       loadingPromise = null;
//     });

//   return loadingPromise;
// }

// export function getStepupLockedSet() {
//   return lockedSet || new Set();
// }

// export function clearStepupLockedSet() {
//   lockedSet = null;
//   loadingPromise = null;
// }
