import { postEncrypted } from "../services/sharedEncryptedRequest";

export async function listPaymentTransactions(input: { username: string; language?: string; payload?: Record<string, any> }) {
  const { username, language = "en", payload = {} } = input;
  return postEncrypted("/admin/payment-transactions/list", { api: "listPaymentTransactions", username, language, ...payload });
}
