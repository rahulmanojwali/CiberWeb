import { postEncrypted } from "./sharedEncryptedRequest";
import {
  API_TAGS,
  API_ROUTES,
  DEFAULT_COUNTRY,
  DEFAULT_LANGUAGE,
} from "../config/appConfig";

export async function fetchStepupPolicies({
  username,
  language = DEFAULT_LANGUAGE,
  country = DEFAULT_COUNTRY,
}: {
  username: string;
  language?: string;
  country?: string;
}) {
  const items: Record<string, any> = {
    api: API_TAGS.STEPUP_POLICY.list,
    username,
    language,
    country,
  };

  return postEncrypted(API_ROUTES.admin.getStepupPolicyRules, items);
}

export async function saveStepupPolicyRule({
  username,
  rule,
  language = DEFAULT_LANGUAGE,
  country = DEFAULT_COUNTRY,
}: {
  username: string;
  rule: Record<string, any>;
  language?: string;
  country?: string;
}) {
  const items: Record<string, any> = {
    api: API_TAGS.STEPUP_POLICY.save,
    username,
    language,
    country,
    rule,
  };
  return postEncrypted(API_ROUTES.admin.saveStepupPolicyRule, items);
}
