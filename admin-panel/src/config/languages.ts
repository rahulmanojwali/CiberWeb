import { DEFAULT_LANGUAGE } from "./appConfig";

export const LANGUAGE_STORAGE_KEY = "cd_lang";

export type LanguageOption = {
  code: string;
  label: string;
  nativeLabel: string;
};

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
  { code: "bn", label: "Bengali", nativeLabel: "বাংলা" },
  { code: "ta", label: "Tamil", nativeLabel: "தமிழ்" },
  { code: "te", label: "Telugu", nativeLabel: "తెలుగు" },
  { code: "mr", label: "Marathi", nativeLabel: "मराठी" },
  { code: "gu", label: "Gujarati", nativeLabel: "ગુજરાતી" },
  { code: "kn", label: "Kannada", nativeLabel: "ಕನ್ನಡ" },
  { code: "ml", label: "Malayalam", nativeLabel: "മലയാളം" },
  { code: "pa", label: "Punjabi", nativeLabel: "ਪੰਜਾਬੀ" },
  { code: "or", label: "Odia", nativeLabel: "ଓଡ଼ିଆ" },
];

export const normalizeLanguageCode = (value?: string | null): string => {
  if (!value) return DEFAULT_LANGUAGE;
  const normalized = value.split("-")[0].toLowerCase();
  const exists = SUPPORTED_LANGUAGES.some((lang) => lang.code === normalized);
  return exists ? normalized : DEFAULT_LANGUAGE;
};

export const getStoredLanguage = (): string => {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(LANGUAGE_STORAGE_KEY) : null;
    return normalizeLanguageCode(raw);
  } catch {
    return DEFAULT_LANGUAGE;
  }
};
