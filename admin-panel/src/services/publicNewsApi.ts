import { postEncrypted } from "./sharedEncryptedRequest";
import { DEFAULT_LANGUAGE } from "../config/appConfig";
export const listPublicNews=({username,language=DEFAULT_LANGUAGE,status=""}:{username:string;language?:string;status?:string})=>postEncrypted("/admin/publicNews/list",{username,country:"IN",language,status});
export const savePublicNews=({username,language=DEFAULT_LANGUAGE,payload}:{username:string;language?:string;payload:Record<string,any>})=>postEncrypted("/admin/publicNews/save",{username,country:"IN",language,...payload});
export const archivePublicNews=({username,language=DEFAULT_LANGUAGE,id}:{username:string;language?:string;id:string})=>postEncrypted("/admin/publicNews/archive",{username,country:"IN",language,_id:id});
