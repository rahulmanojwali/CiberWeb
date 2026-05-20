import { postEncrypted } from "../services/sharedEncryptedRequest";

export async function listPaymentGatewayConfigs(input: { username: string; language?: string; payload?: Record<string, any> }) {
  const { username, language = "en", payload = {} } = input;
  return postEncrypted("/admin/payment-gateway-configs/list", { api: "listPaymentGatewayConfigs", username, language, ...payload });
}

export async function savePaymentGatewayConfig(input: { username: string; language?: string; payload?: Record<string, any> }) {
  const { username, language = "en", payload = {} } = input;
  return postEncrypted("/admin/payment-gateway-configs/save", { api: "savePaymentGatewayConfig", username, language, ...payload });
}

export async function togglePaymentGatewayConfig(input: { username: string; language?: string; payload?: Record<string, any> }) {
  const { username, language = "en", payload = {} } = input;
  return postEncrypted("/admin/payment-gateway-configs/toggle", { api: "togglePaymentGatewayConfig", username, language, ...payload });
}

export async function setDefaultPaymentGatewayConfig(input: { username: string; language?: string; payload?: Record<string, any> }) {
  const { username, language = "en", payload = {} } = input;
  return postEncrypted("/admin/payment-gateway-configs/set-default", { api: "setDefaultPaymentGatewayConfig", username, language, ...payload });
}

export async function testPaymentGatewayConfig(input: { username: string; language?: string; payload?: Record<string, any> }) {
  const { username, language = "en", payload = {} } = input;
  return postEncrypted("/admin/payment-gateway-configs/test", { api: "testPaymentGatewayConfig", username, language, ...payload });
}
