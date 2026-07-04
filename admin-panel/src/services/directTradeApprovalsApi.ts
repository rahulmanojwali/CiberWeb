import { postEncrypted } from "./sharedEncryptedRequest";
import { DEFAULT_LANGUAGE } from "../config/appConfig";

export type DirectTradeApprovalFilters = {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  media_type?: string;
};

function unwrap(data: any) {
  return data?.data || data?.response?.data || data || {};
}

export async function listDirectTradeApprovalQueue({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: DirectTradeApprovalFilters;
}) {
  const response = await postEncrypted("/admin/direct-trade/approval-queue", {
    api: "listDirectTradeApprovalQueue",
    username,
    language,
    ...filters,
  });
  return unwrap(response);
}

export async function getDirectTradeApprovalDetails({
  username,
  language = DEFAULT_LANGUAGE,
  listing_id,
}: {
  username: string;
  language?: string;
  listing_id: string;
}) {
  const response = await postEncrypted("/admin/direct-trade/approval-details", {
    api: "getDirectTradeApprovalDetails",
    username,
    language,
    listing_id,
  });
  return unwrap(response);
}

export async function updateDirectTradeApprovalStatus({
  username,
  language = DEFAULT_LANGUAGE,
  listing_id,
  approval_action,
  remarks,
  review_payload,
}: {
  username: string;
  language?: string;
  listing_id: string;
  approval_action: "APPROVE" | "REJECT" | "REQUEST_CHANGES" | "PUBLISH";
  remarks?: string;
  review_payload?: any;
}) {
  const response = await postEncrypted("/admin/direct-trade/approval-action", {
    api: "updateDirectTradeApprovalStatus",
    username,
    language,
    listing_id,
    approval_action,
    remarks: remarks || "",
    review_payload: review_payload || {},
  });
  return response;
}
