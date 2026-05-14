import axios from "axios";
import { API_BASE_URL, API_ROUTES, API_TAGS, DEFAULT_LANGUAGE } from "../config/appConfig";
import { postEncrypted } from "./sharedEncryptedRequest";

export const getAuctionPolicySettings = async ({
  username,
  language = DEFAULT_LANGUAGE,
  org_id,
}: {
  username: string;
  language?: string;
  org_id?: string;
}) => {
  const params: Record<string, string> = {
    api: API_TAGS.AUCTION_POLICY_SETTINGS.get,
    username,
    language,
  };
  if (org_id) params.org_id = org_id;
  const response = await axios.get(`${API_BASE_URL}${API_ROUTES.admin.getAuctionPolicySettings}`, { params });
  return response.data;
};

export const updateAuctionPolicySettings = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: {
    policy_scope: "PLATFORM" | "ORG";
    org_id?: string;
    policy: Record<string, unknown>;
  };
}) =>
  postEncrypted(API_ROUTES.admin.updateAuctionPolicySettings, {
    api: API_TAGS.AUCTION_POLICY_SETTINGS.update,
    username,
    language,
    ...payload,
  });
