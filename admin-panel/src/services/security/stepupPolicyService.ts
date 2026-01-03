import { postEncrypted } from "../sharedEncryptedRequest";
import {
  API_ROUTES,
  API_TAGS,
  DEFAULT_COUNTRY,
  DEFAULT_LANGUAGE,
} from "../../config/appConfig";

export type StepupScreensParams = {
  username: string;
  language?: string;
  country?: string;
};

export async function getStepupPolicyScreens({
  username,
  language = DEFAULT_LANGUAGE,
  country = DEFAULT_COUNTRY,
}: StepupScreensParams) {
  const items: Record<string, any> = {
    api: API_TAGS.STEPUP_POLICY.getScreens,
    username,
    language,
    country,
  };
  return postEncrypted(API_ROUTES.admin.getStepupPolicyScreens, items);
}

export type StepupSelectionPayload = {
  username: string;
  selected: string[];
  language?: string;
  country?: string;
};

export async function saveStepupPolicySelection({
  username,
  selected,
  language = DEFAULT_LANGUAGE,
  country = DEFAULT_COUNTRY,
}: StepupSelectionPayload) {
  const items: Record<string, any> = {
    api: API_TAGS.STEPUP_POLICY.saveSelection,
    username,
    language,
    country,
    selected,
  };
  return postEncrypted(API_ROUTES.admin.saveStepupPolicySelection, items);
}
