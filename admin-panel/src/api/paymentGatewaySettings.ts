import { postEncrypted } from "../services/sharedEncryptedRequest";

export async function listPaymentGatewaySettings(input: { username: string; language?: string; payload?: Record<string, any> }) {
  const { username, language = "en", payload = {} } = input;
  return postEncrypted("/admin/payment-gateway-settings/list", { api: "listPaymentGatewaySettings", username, language, ...payload });
}

export async function savePaymentGatewaySettings(input: { username: string; language?: string; payload?: Record<string, any> }) {
  const { username, language = "en", payload = {} } = input;
  return postEncrypted("/admin/payment-gateway-settings/save", { api: "savePaymentGatewaySettings", username, language, ...payload });
}

export async function setDefaultPaymentGateway(input: { username: string; language?: string; payload?: Record<string, any> }) {
  const { username, language = "en", payload = {} } = input;
  return postEncrypted("/admin/payment-gateway-settings/set-default", { api: "setDefaultPaymentGateway", username, language, ...payload });
}

export async function togglePaymentGatewaySettings(input: { username: string; language?: string; payload?: Record<string, any> }) {
  const { username, language = "en", payload = {} } = input;
  return postEncrypted("/admin/payment-gateway-settings/toggle", { api: "togglePaymentGatewaySettings", username, language, ...payload });
}
