import { postEncrypted } from "./sharedEncryptedRequest";
import { API_TAGS, API_ROUTES, DEFAULT_LANGUAGE } from "../config/appConfig";

export const fetchMandiAssociationRequests = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getMandiAssociationRequests, {
    api: API_TAGS.MANDI_ASSOCIATIONS.list,
    username,
    language,
    ...filters,
  });

export const updateMandiAssociationRequest = async (payload: Record<string, any>) =>
  postEncrypted(API_ROUTES.admin.updateMandiAssociationRequest, {
    api: API_TAGS.MANDI_ASSOCIATIONS.update,
    ...payload,
  });
