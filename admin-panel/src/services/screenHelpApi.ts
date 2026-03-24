import axios from "axios";

export type FetchScreenHelpParams = {
  route: string;
  lang: string;
  platform: "WEB" | "BOTH";
};

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
  const attempts: FetchScreenHelpParams[] = [
    { route, lang, platform: "WEB" },
    { route, lang, platform: "BOTH" },
    { route, lang: "en", platform: "WEB" },
    { route, lang: "en", platform: "BOTH" },
  ];

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