export const buildMandiNameMap = (
  mandis: Array<any> = [],
  language: string = "en",
): Map<string, string> => {
  const map = new Map<string, string>();
  mandis.forEach((m) => {
    const id = String(m?.mandi_id ?? m?.mandiId ?? "");
    if (!id) return;
    const label =
      m?.name_i18n?.[language] ||
      m?.name_i18n?.en ||
      m?.mandi_name ||
      m?.mandi_slug ||
      id;
    map.set(id, label);
  });
  return map;
};

export const resolveMandiName = (map: Map<string, string>, mandiId?: string | number | null) => {
  if (mandiId === undefined || mandiId === null) return "";
  return map.get(String(mandiId)) || String(mandiId);
};

