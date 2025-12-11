export function normalizeFlag(flag: any): "Y" | "N" {
  if (flag === true) return "Y";
  if (flag === false) return "N";
  const s = String(flag ?? "").trim().toUpperCase();
  if (["Y", "YES", "TRUE", "1"].includes(s)) return "Y";
  if (["N", "NO", "FALSE", "0"].includes(s)) return "N";
  return "N";
}

export function flagToBoolean(flag: any): boolean {
  return normalizeFlag(flag) === "Y";
}
