import { postEncrypted } from "./sharedEncryptedRequest";
import { API_ROUTES, API_TAGS, DEFAULT_LANGUAGE } from "../config/appConfig";

export const fetchStatesDistrictsByPincode = async ({
  username,
  language = DEFAULT_LANGUAGE,
  pincode,
  country = "IN",
}: {
  username: string;
  language?: string;
  pincode: string;
  country?: string;
}) =>
  postEncrypted(API_ROUTES.masters.getStatesDistricts, {
    api: API_TAGS.MASTERS.getStatesDistricts,
    username,
    language,
    country,
    pincode,
    include_inactive: false,
  });
