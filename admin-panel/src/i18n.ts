import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { buildResources } from "./locales/resources";
import { LANGUAGE_STORAGE_KEY, SUPPORTED_LANGUAGES } from "./config/languages";
import { DEFAULT_LANGUAGE } from "./config/appConfig";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES.map((lang) => lang.code),
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
    },
    resources: buildResources(),
    interpolation: { escapeValue: false },
  });

export default i18n;
