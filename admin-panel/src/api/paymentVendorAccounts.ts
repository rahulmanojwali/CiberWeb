import { postEncrypted } from "../services/sharedEncryptedRequest";

export async function upsertPaymentVendorAccount(input: { username: string; language?: string; payload?: Record<string, any> }) {
  const { username, language = "en", payload = {} } = input;
  return postEncrypted("/payment-vendors/upsert", { api: "upsertPaymentVendorAccount", username, language, ...payload });
}

export async function getPaymentVendorAccount(input: { username: string; language?: string; payload?: Record<string, any> }) {
  const { username, language = "en", payload = {} } = input;
  return postEncrypted("/payment-vendors/get", { api: "getPaymentVendorAccount", username, language, ...payload });
}

export async function resolvePaymentVendorsForSettlement(input: { username: string; language?: string; payload?: Record<string, any> }) {
  const { username, language = "en", payload = {} } = input;
  return postEncrypted("/payment-vendors/resolve-for-settlement", { api: "resolvePaymentVendorsForSettlement", username, language, ...payload });
}

export async function verifyPaymentVendorBank(input: { username: string; language?: string; payload?: Record<string, any> }) {
  const { username, language = "en", payload = {} } = input;
  return postEncrypted("/payment-vendors/verify-bank", { api: "verifyPaymentVendorBank", username, language, ...payload });
}

export async function verifyPaymentVendorUpi(input: { username: string; language?: string; payload?: Record<string, any> }) {
  const { username, language = "en", payload = {} } = input;
  return postEncrypted("/payment-vendors/verify-upi", { api: "verifyPaymentVendorUpi", username, language, ...payload });
}
