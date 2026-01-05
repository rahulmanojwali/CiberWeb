// export type OrgDisplayable = {
//   org_name?: string | null;
//   name?: string | null;
//   label?: string | null;
// };

// export function getOrgDisplayName(org?: OrgDisplayable | null): string {
//   const name = String(org?.org_name || org?.name || org?.label || '').trim();
//   if (name) return name;
//   return 'Unknown organisation';
// }
export type OrgDisplayable = {
  org_code?: string | null;
  org_name?: string | null;
  name?: string | null;
  label?: string | null;
};

export function getOrgDisplayName(org?: OrgDisplayable | null): string {
  const name = String(org?.org_name || org?.name || org?.label || "").trim();
  if (name) return name;

  const code = String(org?.org_code || "").trim();
  if (code) return code;

  return "Unknown organisation";
}
