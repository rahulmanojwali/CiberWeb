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

export type StoredAdminUser = {
  username?: string;
  language?: string;
  country?: string;
};

export function getStoredAdminUser(): StoredAdminUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("cd_user");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return {
      username: parsed?.username,
      language: parsed?.language,
      country: parsed?.country,
    };
  } catch {
    return null;
  }
}
