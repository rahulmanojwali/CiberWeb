import { postEncrypted } from "../services/sharedEncryptedRequest";

export type SettlementListFilters = {
  org_id?: string;
  mandi_id?: string | number;
  status?: string;
  session_id?: string;
  lot_code?: string;
  trader_username?: string;
  farmer_username?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
};

export async function listAuctionSettlements(input: {
  username: string;
  language?: string;
  filters?: SettlementListFilters;
}) {
  const { username, language = "en", filters = {} } = input;
  return postEncrypted("/admin/auction-settlements/list", {
    api: "listAuctionSettlements",
    username,
    language,
    ...filters,
  });
}

export async function updateAuctionSettlementStatus(input: {
  username: string;
  language?: string;
  settlement_id: string;
  status: string;
  reason?: string;
}) {
  const { username, language = "en", settlement_id, status, reason } = input;
  return postEncrypted("/admin/auction-settlements/update-status", {
    api: "updateAuctionSettlementStatus",
    username,
    language,
    settlement_id,
    status,
    reason,
  });
}

export async function verifySettlementPayment(input: {
  username: string;
  language?: string;
  settlement_id: string;
  note?: string;
}) {
  const { username, language = "en", settlement_id, note } = input;
  return postEncrypted("/admin/verifySettlementPayment", {
    api: "verifySettlementPayment",
    username,
    language,
    settlement_id,
    note,
  });
}

export async function rejectSettlementPayment(input: {
  username: string;
  language?: string;
  settlement_id: string;
  note?: string;
}) {
  const { username, language = "en", settlement_id, note } = input;
  return postEncrypted("/admin/rejectSettlementPayment", {
    api: "rejectSettlementPayment",
    username,
    language,
    settlement_id,
    note,
  });
}
