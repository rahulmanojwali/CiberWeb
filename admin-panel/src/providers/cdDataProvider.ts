// @ts-nocheck  // keep this if your Refine version has incompatible types
import type { DataProvider } from "@refinedev/core";
import { encryptGenericPayload } from "../utils/aesUtilBrowser";
import { API_BASE_URL } from "../config/appConfig";
import { getBrowserSessionId } from "../security/stepup/browserSession";
import { getStepupSessionId } from "../security/stepup/storage";
import {
  deriveStepupResourceKey,
  isStepupExemptPath,
  runEncryptedRequest,
} from "../services/encryptedRequestRunner";

const API_URL = API_BASE_URL;

/** Helper to POST { encryptedData } to a path with given items */
async function securePost(path: string, items: Record<string, any>) {
  const encryptedData = await encryptGenericPayload(JSON.stringify({ items }));
  const url = `${API_URL}${path}`;
  const browserSessionId = getBrowserSessionId();
  const stepupSessionId = getStepupSessionId();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (browserSessionId) {
    headers["x-cm-browser-session"] = browserSessionId;
    headers["x-stepup-browser-session"] = browserSessionId;
  }
  if (stepupSessionId) {
    headers["x-stepup-session"] = stepupSessionId;
  }
  const data = await runEncryptedRequest({
    url,
    body: { encryptedData },
    headers,
    path,
    resourceKey: deriveStepupResourceKey(items),
    excludeStepup: isStepupExemptPath(path),
  });
  return { url, data };
}

/** Normalize pagination safely across refine versions */
function normalizePagination(pagination: any) {
  // refine versions use either { current, pageSize } or { page, perPage }
  const current =
    pagination?.current ??
    pagination?.page ??
    1;
  const pageSize =
    pagination?.pageSize ??
    pagination?.perPage ??
    10;
  return { current, pageSize };
}

/** Normalize sorters into { [field]: "asc" | "desc" } */
function normalizeSorters(sorters: any[]): Record<string, "asc" | "desc"> {
  const orderBy: Record<string, "asc" | "desc"> = {};
  (sorters ?? []).forEach((s) => {
    const field = (s && (s.field ?? s.key ?? s.column)) || undefined;
    if (!field) return;
    const dir = (s.order ?? s.direction ?? "asc").toString().toLowerCase();
    orderBy[field] = dir === "asc" ? "asc" : "desc";
  });
  return orderBy;
}

/** Normalize filters into a flat { field: value } map (tweak as your API needs) */
function normalizeFilters(filters: any[]): Record<string, any> {
  const where: Record<string, any> = {};
  (filters ?? []).forEach((f) => {
    // CrudFilter style: { field, operator, value }
    if (f && typeof f === "object" && "field" in f) {
      const field = f.field as string;
      const value = (f as any).value;
      if (field) where[field] = value;
      return;
    }
    // ConditionalFilter / logical filters: handle nested children
    if (f && typeof f === "object" && "operator" in f && Array.isArray((f as any).value)) {
      (f as any).value.forEach((child: any) => {
        if (child?.field) where[child.field] = child.value;
      });
      return;
    }
    // Fallback: key/value style
    if (f && typeof f === "object") {
      Object.entries(f).forEach(([k, v]) => (where[k] = v));
    }
  });
  return where;
}

/** Minimal encrypted DataProvider */
export const cdDataProvider = (resourceToPath: Record<string, string>): DataProvider => ({
  // LIST
  getList: async ({ resource, pagination, filters, sorters }: any) => {
    const path = resourceToPath[resource];
    if (!path) throw new Error(`No endpoint mapped for resource "${resource}"`);

    const { current, pageSize } = normalizePagination(pagination);
    const where = normalizeFilters(filters as any[]);
    const orderBy = normalizeSorters(sorters as any[]);

    // Build items your backend expects (adjust names as needed)
    const items = {
      api: "<<<PUT_correct_api_key_for_this_list_here>>>",
      page: current,
      limit: pageSize,
      where,
      orderBy,
    };

    const { url, data: raw } = await securePost(path, items);
    console.info({ event: "getList_response", resource, path, url, raw });

    // Adapt backend → refine shape
    const rows = raw?.rows ?? raw?.data ?? [];
    const total = raw?.total ?? rows.length ?? 0;
    const data = rows.map((r: any, i: number) => ({
      id: r.id ?? r._id ?? r.username ?? r.code ?? `${i}_${Date.now()}`,
      ...r,
    }));

    return { data, total };
  },

  // STUBS — fill these as you wire endpoints
  getOne: async () => ({ data: {} as any }),
  create: async () => ({ data: {} as any }),
  update: async () => ({ data: {} as any }),
  deleteOne: async () => ({ data: {} as any }),
  getMany: async () => ({ data: [] }),
  updateMany: async () => ({ data: [] }),
  deleteMany: async () => ({ data: [] }),
  getApiUrl: () => API_URL,
});

// // @ts-nocheck  // keep this if your Refine version has incompatible types
// import axios from "axios";
// import type { DataProvider } from "@refinedev/core";
// import { encryptGenericPayload } from "../utils/aesUtilBrowser";
// import { API_BASE_URL } from "../config/appConfig";
// import { getBrowserSessionId } from "../security/stepup/browserSession";

// const API_URL = API_BASE_URL;

// /** Helper to POST { encryptedData } to a path with given items */
// async function securePost(path: string, items: Record<string, any>) {
//   const encryptedData = await encryptGenericPayload(JSON.stringify({ items }));
//   const url = `${API_URL}${path}`;
//   const browserSessionId = getBrowserSessionId();
//   const headers: Record<string, string> = {
//     "Content-Type": "application/json",
//   };
//   if (browserSessionId) {
//     headers["x-cm-browser-session"] = browserSessionId;
//     headers["x-stepup-browser-session"] = browserSessionId;
//   }
//   const { data } = await axios.post(url, { encryptedData }, { headers });
//   return { url, data };
// }

// /** Normalize pagination safely across refine versions */
// function normalizePagination(pagination: any) {
//   // refine versions use either { current, pageSize } or { page, perPage }
//   const current =
//     pagination?.current ??
//     pagination?.page ??
//     1;
//   const pageSize =
//     pagination?.pageSize ??
//     pagination?.perPage ??
//     10;
//   return { current, pageSize };
// }

// /** Normalize sorters into { [field]: "asc" | "desc" } */
// function normalizeSorters(sorters: any[]): Record<string, "asc" | "desc"> {
//   const orderBy: Record<string, "asc" | "desc"> = {};
//   (sorters ?? []).forEach((s) => {
//     const field = (s && (s.field ?? s.key ?? s.column)) || undefined;
//     if (!field) return;
//     const dir = (s.order ?? s.direction ?? "asc").toString().toLowerCase();
//     orderBy[field] = dir === "asc" ? "asc" : "desc";
//   });
//   return orderBy;
// }

// /** Normalize filters into a flat { field: value } map (tweak as your API needs) */
// function normalizeFilters(filters: any[]): Record<string, any> {
//   const where: Record<string, any> = {};
//   (filters ?? []).forEach((f) => {
//     // CrudFilter style: { field, operator, value }
//     if (f && typeof f === "object" && "field" in f) {
//       const field = f.field as string;
//       const value = (f as any).value;
//       if (field) where[field] = value;
//       return;
//     }
//     // ConditionalFilter / logical filters: handle nested children
//     if (f && typeof f === "object" && "operator" in f && Array.isArray((f as any).value)) {
//       (f as any).value.forEach((child: any) => {
//         if (child?.field) where[child.field] = child.value;
//       });
//       return;
//     }
//     // Fallback: key/value style
//     if (f && typeof f === "object") {
//       Object.entries(f).forEach(([k, v]) => (where[k] = v));
//     }
//   });
//   return where;
// }

// /** Minimal encrypted DataProvider */
// export const cdDataProvider = (resourceToPath: Record<string, string>): DataProvider => ({
//   // LIST
//   getList: async ({ resource, pagination, filters, sorters }: any) => {
//     const path = resourceToPath[resource];
//     if (!path) throw new Error(`No endpoint mapped for resource "${resource}"`);

//     const { current, pageSize } = normalizePagination(pagination);
//     const where = normalizeFilters(filters as any[]);
//     const orderBy = normalizeSorters(sorters as any[]);

//     // Build items your backend expects (adjust names as needed)
//     const items = {
//       api: "<<<PUT_correct_api_key_for_this_list_here>>>",
//       page: current,
//       limit: pageSize,
//       where,
//       orderBy,
//     };

//     const { url, data: raw } = await securePost(path, items);
//     console.info({ event: "getList_response", resource, path, url, raw });

//     // Adapt backend → refine shape
//     const rows = raw?.rows ?? raw?.data ?? [];
//     const total = raw?.total ?? rows.length ?? 0;
//     const data = rows.map((r: any, i: number) => ({
//       id: r.id ?? r._id ?? r.username ?? r.code ?? `${i}_${Date.now()}`,
//       ...r,
//     }));

//     return { data, total };
//   },

//   // STUBS — fill these as you wire endpoints
//   getOne: async () => ({ data: {} as any }),
//   create: async () => ({ data: {} as any }),
//   update: async () => ({ data: {} as any }),
//   deleteOne: async () => ({ data: {} as any }),
//   getMany: async () => ({ data: [] }),
//   updateMany: async () => ({ data: [] }),
//   deleteMany: async () => ({ data: [] }),
//   getApiUrl: () => API_URL,
// });
