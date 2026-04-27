import { API_ROUTES, API_TAGS, DEFAULT_LANGUAGE } from "../config/appConfig";
import { postEncrypted } from "./sharedEncryptedRequest";

export const getAuctionCapacityControl = async ({
  username,
  language = DEFAULT_LANGUAGE,
}: {
  username: string;
  language?: string;
}) =>
  postEncrypted(API_ROUTES.admin.getAuctionCapacityControl, {
    api: API_TAGS.SYSTEM_CAPACITY_CONTROL.get,
    username,
    language,
  });

export const updateAuctionCapacityControl = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.updateAuctionCapacityControl, {
    api: API_TAGS.SYSTEM_CAPACITY_CONTROL.update,
    username,
    language,
    ...payload,
  });

export const updatePhysicalInfrastructureCapacity = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted("/admin/system/updatePhysicalInfrastructureCapacity", {
    api: API_TAGS.SYSTEM_CAPACITY_CONTROL.update,
    username,
    language,
    ...payload,
  });

export const updatePlatformAuctionCapacity = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted("/admin/system/updatePlatformAuctionCapacity", {
    api: API_TAGS.SYSTEM_CAPACITY_CONTROL.update,
    username,
    language,
    ...payload,
  });

export const updateTestingCapacity = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.updateTestingCapacity, {
    api: API_TAGS.SYSTEM_CAPACITY_CONTROL.updateTesting,
    username,
    language,
    ...payload,
  });

export const updateOrgAuctionCapacityAllocation = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.updateOrgAuctionCapacityAllocation, {
    api: API_TAGS.SYSTEM_CAPACITY_CONTROL.updateOrg,
    username,
    language,
    ...payload,
  });
