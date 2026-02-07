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
  postEncrypted(API_ROUTES.admin.listFarmerApprovals, {
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
  postEncrypted(API_ROUTES.admin.approveFarmer, {
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
  postEncrypted(API_ROUTES.admin.rejectFarmer, {
    api: API_TAGS.FARMER_APPROVALS.reject,
    username,
    language,
    ...payload,
  });


export const requestMoreInfoFarmer = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.requestMoreInfoFarmer, {
    api: API_TAGS.FARMER_APPROVALS.requestMoreInfo,
    username,
    language,
    ...payload,
  });

export const reactivateFarmer = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.reactivateFarmer, {
    api: API_TAGS.FARMER_APPROVALS.reactivate,
    username,
    language,
    ...payload,
  });
