import { postEncrypted } from "./sharedEncryptedRequest";
import { API_ROUTES, API_TAGS, DEFAULT_LANGUAGE } from "../config/appConfig";

export const listFarmerApprovalRequests = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.listFarmerApprovalRequests, {
    api: API_TAGS.FARMER_APPROVALS.list,
    username,
    language,
    ...filters,
  });

export const approveFarmerForMandis = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.approveFarmerForMandis, {
    api: API_TAGS.FARMER_APPROVALS.approve,
    username,
    language,
    ...payload,
  });

export const rejectFarmerApproval = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.rejectFarmerApproval, {
    api: API_TAGS.FARMER_APPROVALS.reject,
    username,
    language,
    ...payload,
  });
