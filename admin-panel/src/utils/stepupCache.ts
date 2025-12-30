import { getStepupPolicyScreens } from "../services/security/stepupPolicyService";

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

function extractSelected(resp: StepupScreensResponse): string[] {
  for (const candidateGetter of RESPONSE_CANDIDATES) {
    const candidate = candidateGetter(resp);
    if (candidate && Array.isArray(candidate.selected)) {
      return candidate.selected
        .map((value: any) => String(value || "").trim().toLowerCase())
        .filter(Boolean);
    }
  }
  return [];
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
      const selected = extractSelected(resp);
      lockedSet = new Set(selected);
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
