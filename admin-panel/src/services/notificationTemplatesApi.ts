import { postEncrypted } from "./sharedEncryptedRequest";
import { API_TAGS, API_ROUTES, DEFAULT_LANGUAGE } from "../config/appConfig";

export const fetchNotificationTemplates = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getNotificationTemplates, {
    api: API_TAGS.NOTIFICATION_TEMPLATES.list,
    username,
    language,
    ...filters,
  });

export const saveNotificationTemplate = async (payload: Record<string, any>) =>
  postEncrypted(API_ROUTES.admin.saveNotificationTemplate, {
    api: API_TAGS.NOTIFICATION_TEMPLATES.save,
    ...payload,
  });

export const previewNotificationTemplate = async (payload: Record<string, any>) =>
  postEncrypted(API_ROUTES.admin.previewNotificationTemplate, {
    api: API_TAGS.NOTIFICATION_TEMPLATES.preview,
    ...payload,
  });

export const testSendNotificationTemplate = async (payload: Record<string, any>) =>
  postEncrypted(API_ROUTES.admin.testSendNotificationTemplate, {
    api: API_TAGS.NOTIFICATION_TEMPLATES.testSend,
    ...payload,
  });

export const validateNotificationTemplatesEnglish = async (payload: Record<string, any>) =>
  postEncrypted(API_ROUTES.admin.validateNotificationTemplatesEnglish, {
    api: API_TAGS.NOTIFICATION_TEMPLATES.validateEnglish,
    ...payload,
  });
