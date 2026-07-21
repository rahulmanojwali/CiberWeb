import { postEncrypted } from "../services/sharedEncryptedRequest";

type Input = { username: string; language?: string; payload?: Record<string, any> };
function call(path: string, api: string, input: Input) {
  const { username, language = "en", payload = {} } = input;
  return postEncrypted(`/admin/platform-module-payment-gateways/${path}`, { api, username, language, ...payload });
}
export const listPlatformModuleGatewayConfigs = (i: Input) => call("list", "listPlatformModulePaymentGatewayConfigs", i);
export const savePlatformModuleGatewayConfig = (i: Input) => call("save", "savePlatformModulePaymentGatewayConfig", i);
export const togglePlatformModuleGatewayConfig = (i: Input) => call("toggle", "togglePlatformModulePaymentGatewayConfig", i);
export const setDefaultPlatformModuleGatewayConfig = (i: Input) => call("set-default", "setDefaultPlatformModulePaymentGatewayConfig", i);
export const testPlatformModuleGatewayConfig = (i: Input) => call("test", "testPlatformModulePaymentGatewayConfig", i);
