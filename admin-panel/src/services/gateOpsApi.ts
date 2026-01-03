import { postEncrypted } from "./sharedEncryptedRequest";
import { API_TAGS, API_ROUTES, DEFAULT_LANGUAGE } from "../config/appConfig";

export const fetchGatePassTokens = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getGatePassTokens, {
    api: API_TAGS.GATE_PASS_TOKENS.list,
    username,
    language,
    ...filters,
  });

export const fetchGateEntryTokens = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getGateEntryTokens, {
    api: API_TAGS.GATE_ENTRY_TOKENS.list,
    username,
    language,
    ...filters,
  });

export const fetchGateMovements = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getGateMovements, {
    api: API_TAGS.GATE_MOVEMENTS.list,
    username,
    language,
    ...filters,
  });

export const fetchWeighmentTickets = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getWeighmentTickets, {
    api: API_TAGS.WEIGHMENT_TICKETS.list,
    username,
    language,
    ...filters,
  });
