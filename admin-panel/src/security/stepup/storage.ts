const STEPUP_SESSION_KEY = "cm_stepup_session_id";

export function getStepupSessionId(): string | null {
  if (typeof window === "undefined") return null;
  const stored = sessionStorage.getItem(STEPUP_SESSION_KEY);
  if (stored) return stored;
  const legacy = localStorage.getItem(STEPUP_SESSION_KEY);
  if (legacy) {
    sessionStorage.setItem(STEPUP_SESSION_KEY, legacy);
    localStorage.removeItem(STEPUP_SESSION_KEY);
    return legacy;
  }
  return null;
}

export function storeStepupSessionId(stepupSessionId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STEPUP_SESSION_KEY, stepupSessionId);
  localStorage.removeItem(STEPUP_SESSION_KEY); // defensive cleanup
}
