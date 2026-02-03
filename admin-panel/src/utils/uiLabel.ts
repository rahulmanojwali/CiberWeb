export function toTitleCaseFromKey(key: string) {
  const base = key.split(".")[0] || key;
  return base
    .replace(/[_\\-]+/g, " ")
    .replace(/\\b\\w/g, (m) => m.toUpperCase());
}

export function getResourceLabel(r: any, lang: string = "en"): string {
  const labelI18n = r?.label_i18n;
  return (
    (labelI18n && labelI18n[lang]) ||
    r.label ||
    r.screen ||
    toTitleCaseFromKey(r.resource_key || "")
  );
}
