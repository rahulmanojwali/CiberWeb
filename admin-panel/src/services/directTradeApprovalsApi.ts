/**
 * Author: CiberMandi Development Team
 * Date: 2026-07-14
 * Description: Encrypted Direct Trade approval API client, including controlled review-message templates.
 * Major methods: list/load approval data, load controlled messages, submit approval decision.
 */
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


export type DirectTradeApprovalRemarkTemplate = {
  code: string;
  action: "APPROVE" | "REJECT" | "REQUEST_CHANGES";
  label: string;
  message: string;
  sort_order?: number;
};

export async function listDirectTradeApprovalRemarkTemplates({
  username,
  language = DEFAULT_LANGUAGE,
  action,
}: {
  username: string;
  language?: string;
  action?: "APPROVE" | "REJECT" | "REQUEST_CHANGES";
}) {
  const response = await postEncrypted(
    "/admin/direct-trade/approval-remark-templates",
    {
      api: "listDirectTradeApprovalRemarkTemplates",
      username,
      language,
      action: action || "",
    },
  );
  const data = unwrap(response);
  return Array.isArray(data?.items) ? data.items : [];
}

export async function updateDirectTradeApprovalStatus({
  username,
  language = DEFAULT_LANGUAGE,
  listing_id,
  approval_action,
  remarks,
  remark_code,
  review_payload,
  media_reviews,
}: {
  username: string;
  language?: string;
  listing_id: string;
  approval_action: "APPROVE" | "REJECT" | "REQUEST_CHANGES" | "PUBLISH";
  remarks?: string;
  remark_code?: string;
  review_payload?: any;
  media_reviews?: any[];
}) {
  const response = await postEncrypted("/admin/direct-trade/approval-action", {
    api: "updateDirectTradeApprovalStatus",
    username,
    language,
    listing_id,
    approval_action,
    remarks: remarks || "",
    remark_code: remark_code || "",
    review_payload: review_payload || {},
    media_reviews: media_reviews || review_payload?.media_reviews || [],
  });
  return response;
}
