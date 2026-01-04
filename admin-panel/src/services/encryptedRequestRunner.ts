import axios from "axios";
import { canonicalizeResourceKey } from "../utils/adminUiConfig";
import { isStepUpReady, triggerStepUp } from "../security/stepup/stepupService";

const STEPUP_RETRY_LIMIT = 1;
const STEPUP_EXEMPT_PATHS = [
  "/admin/2fa/",
  "/auth/login",
  "/auth/loginUser",
  "/admin/security/getStepupPolicyScreens",
  "/admin/security/saveStepupPolicySelection",
  "/admin/security/getSecuritySwitches",
  "/admin/security/updateSecuritySwitches",
];

let stepupInFlight: Promise<boolean> | null = null;

function isStepupExemptPath(path?: string | null): boolean {
  if (!path) return true;
  return STEPUP_EXEMPT_PATHS.some((segment) => path.includes(segment));
}

function extractStepupPayload(data: any): any | null {
  const candidates = [
    data?.stepup,
    data?.stepup?.stepup,
    data?.response?.stepup,
    data?.response?.stepup?.stepup,
    data?.response,
  ];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object") {
      return candidate;
    }
  }
  return null;
}

function shouldHandleStepupChallenge(error: any, path: string): boolean {
  if (!isStepUpReady()) return false;
  if (isStepupExemptPath(path)) return false;
  const status = error?.response?.status;
  if (status !== 403) return false;
  const payload = extractStepupPayload(error?.response?.data);
  return Boolean(payload?.required === true);
}

async function ensureStepUpSession(resourceKey?: string | null) {
  if (!isStepUpReady()) {
    return false;
  }
  if (!stepupInFlight) {
    stepupInFlight = (async () => {
      try {
        return await triggerStepUp(resourceKey);
      } finally {
        stepupInFlight = null;
      }
    })();
  }
  return stepupInFlight;
}

export function deriveStepupResourceKey(items?: Record<string, any>): string | null {
  if (!items) return null;
  const candidates = [
    items.resource_key,
    items.resourceKey,
    items.resource,
    items.route,
    items.ui_route,
    items.api,
  ];
  for (const raw of candidates) {
    if (typeof raw === "string" && raw.trim()) {
      const canonical = canonicalizeResourceKey(raw);
      if (canonical) return canonical;
    }
  }
  return null;
}

export interface RunEncryptedRequestOptions {
  url: string;
  body: any;
  headersFactory: () => Record<string, string>;
  path: string;
  resourceKey?: string | null;
  excludeStepup?: boolean;
  retryCount?: number;
}

export async function runEncryptedRequest({
  url,
  body,
  headersFactory,
  path,
  resourceKey,
  excludeStepup = false,
  retryCount = 0,
}: RunEncryptedRequestOptions) {
  try {
    const currentHeaders = headersFactory();
    const response = await axios.post(url, body, { headers: currentHeaders });
    return response.data;
  } catch (error: any) {
    if (
      retryCount >= STEPUP_RETRY_LIMIT ||
      excludeStepup ||
      !shouldHandleStepupChallenge(error, path)
    ) {
      throw error;
    }

    const verified = await ensureStepUpSession(resourceKey);
    if (!verified) {
      throw error;
    }

    return runEncryptedRequest({
      url,
      body,
      headersFactory,
      path,
      resourceKey,
      excludeStepup,
      retryCount: retryCount + 1,
    });
  }
}

export { isStepupExemptPath };
