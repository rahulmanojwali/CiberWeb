const STORAGE_KEY = "cm_browser_session_id";

function generateBrowserSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export function getBrowserSessionId(): string | null {
  if (typeof window === "undefined") return null;
  const { localStorage, sessionStorage } = window;
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    const legacy = sessionStorage.getItem(STORAGE_KEY);
    if (legacy) {
      id = legacy;
      localStorage.setItem(STORAGE_KEY, legacy);
      sessionStorage.removeItem(STORAGE_KEY);
    } else {
      id = generateBrowserSessionId();
      localStorage.setItem(STORAGE_KEY, id);
    }
  }
  return id;
}

export function clearBrowserSessionId() {
  if (typeof window === "undefined") return;
  const { localStorage, sessionStorage } = window;
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
}
