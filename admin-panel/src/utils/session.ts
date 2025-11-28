export function getCurrentAdminUsername(): string | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("cd_user");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.username || null;
  } catch {
    return null;
  }
}
