import axios from "axios";

export type FetchScreenHelpParams = {
  route: string;
  lang: string;
  platform: "WEB" | "BOTH";
};

function normalizeRoute(route: string) {
  const raw = String(route || "").trim();
  if (!raw) return "";
  let normalized = raw.startsWith("/") ? raw : `/${raw}`;
  if (normalized.length > 1) {
    normalized = normalized.replace(/\/+$/, "");
  }
  return normalized;
}

function buildRouteCandidates(route: string) {
  const normalized = normalizeRoute(route);
  if (!normalized) return [];

  const candidates: string[] = [normalized];
  if (normalized.startsWith("/admin/")) {
    const stripped = normalizeRoute(normalized.replace(/^\/admin\/+/, "/"));
    if (stripped) candidates.push(stripped);
  } else if (normalized !== "/admin") {
    const adminPrefixed = normalizeRoute(`/admin${normalized}`);
    if (adminPrefixed) candidates.push(adminPrefixed);
  }

  return Array.from(new Set(candidates.filter(Boolean)));
}

function getCurrentUser() {
  try {
    const raw = localStorage.getItem("cd_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function buildHeaders() {
  const user = getCurrentUser();
  const token = user?.token || user?.session_token || "";
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchScreenHelp(params: FetchScreenHelpParams) {
  const response = await axios.post(
    "/api/admin/getScreenHelp",
    {
      route: params.route,
      lang: params.lang,
      platform: params.platform,
      is_active: "Y",
    },
    {
      headers: buildHeaders(),
    }
  );

  return response.data;
}

export async function fetchScreenHelpWithFallback(route: string, lang: string) {
  const routeCandidates = buildRouteCandidates(route);
  const attempts: FetchScreenHelpParams[] = routeCandidates.flatMap((routeCandidate) => ([
    { route: routeCandidate, lang, platform: "WEB" as const },
    { route: routeCandidate, lang, platform: "BOTH" as const },
    { route: routeCandidate, lang: "en", platform: "WEB" as const },
    { route: routeCandidate, lang: "en", platform: "BOTH" as const },
  ]));

  for (const attempt of attempts) {
    try {
      const data = await fetchScreenHelp(attempt);
      const doc =
        data?.data ||
        data?.response?.data ||
        data?.help ||
        data?.screen_help ||
        null;

      if (doc) {
        return doc;
      }
    } catch (_) {
      // continue fallback
    }
  }

  return null;
}

export async function getScreenHelp(route: string, lang: string) {
  return fetchScreenHelpWithFallback(route, lang);
}
