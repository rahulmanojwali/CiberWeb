export function toTitleCaseFromKey(key: string) {
  const base = key.split(".")[0] || key;
  return base
    .replace(/[_\\-]+/g, " ")
    .replace(/\\b\\w/g, (m) => m.toUpperCase());
}

export function getResourceLabel(r: any): string {
  return (
    r.label ||
    r.title ||
    r.display_name ||
    r.screen ||
    r.name ||
    r.resource_name ||
    r.menu_name ||
    toTitleCaseFromKey(r.resource_key || "")
  );
}
