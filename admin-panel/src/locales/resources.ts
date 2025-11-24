import type { Resource } from "i18next";
import en from "./en/common.json";
import hi from "./hi/common.json";
import { SUPPORTED_LANGUAGES } from "../config/languages";

type TranslationNode = Record<string, any>;

const mergeTranslations = (base: TranslationNode, override?: TranslationNode): TranslationNode => {
  if (!override) return base;
  const result: TranslationNode = Array.isArray(base) ? [...base] : { ...base };
  Object.keys(override).forEach((key) => {
    const baseValue = (base as TranslationNode)[key];
    const overrideValue = override[key];
    if (
      baseValue &&
      typeof baseValue === "object" &&
      !Array.isArray(baseValue) &&
      overrideValue &&
      typeof overrideValue === "object" &&
      !Array.isArray(overrideValue)
    ) {
      result[key] = mergeTranslations(baseValue, overrideValue);
    } else {
      result[key] = overrideValue;
    }
  });
  return result;
};

const overrides: Record<string, TranslationNode> = {
  hi,
};

export const buildResources = (): Resource => {
  const resource: Resource = {
    en: { translation: en },
  };

  SUPPORTED_LANGUAGES.forEach((lang) => {
    if (lang.code === "en") return;
    const override = overrides[lang.code];
    if (override) {
      resource[lang.code] = {
        translation: mergeTranslations(en, override),
      };
    } else {
      resource[lang.code] = { translation: en };
    }
  });

  return resource;
};
