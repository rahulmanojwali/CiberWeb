const STORAGE_KEY = "cm_browser_session_id";

function generateBrowserSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export function getBrowserSessionId(): string | null {
  if (typeof window === "undefined") return null;
  let id = sessionStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = generateBrowserSessionId();
    sessionStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

export function clearBrowserSessionId() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}
