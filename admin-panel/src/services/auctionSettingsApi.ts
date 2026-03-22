import { DEFAULT_LANGUAGE } from "../config/appConfig";
import { getMandiSettings, upsertMandiSettings } from "./mandiSettingsApi";

export const getAuctionSettings = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  getMandiSettings({ username, language, filters });

export const upsertAuctionSettings = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  upsertMandiSettings({ username, language, payload });
