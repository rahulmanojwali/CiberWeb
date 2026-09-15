import { postEncrypted } from "./sharedEncryptedRequest";
import { API_ROUTES, API_TAGS, DEFAULT_LANGUAGE } from "../config/appConfig";

export async function fetchResourceHealth({ username, language = DEFAULT_LANGUAGE }: { username: string; language?: string }) {
  return postEncrypted(API_ROUTES.admin.getResourceRegistry, {
    api: API_TAGS.RESOURCE_REGISTRY.list,
    username,
    language,
    mode: "HEALTH",
  });
}

export async function fetchResourceHealthSnapshots({ username, language = DEFAULT_LANGUAGE, page = 1, pageSize = 10 }: { username: string; language?: string; page?: number; pageSize?: number }) {
  return postEncrypted(API_ROUTES.admin.getResourceRegistry, {
    api: API_TAGS.RESOURCE_REGISTRY.list,
    username,
    language,
    mode: "SNAPSHOTS",
    page,
    page_size: pageSize,
  });
}

export async function compareResourceHealthSnapshot({ username, snapshotId, language = DEFAULT_LANGUAGE }: { username: string; snapshotId: string; language?: string }) {
  return postEncrypted(API_ROUTES.admin.getResourceRegistry, {
    api: API_TAGS.RESOURCE_REGISTRY.list,
    username,
    language,
    mode: "COMPARE_SNAPSHOT",
    snapshot_id: snapshotId,
  });
}

export async function createResourceHealthSnapshot({ username, reason, language = DEFAULT_LANGUAGE, stepupSessionId, browserSessionId }: { username: string; reason: string; language?: string; stepupSessionId?: string; browserSessionId?: string }) {
  return postEncrypted(API_ROUTES.admin.updateResourceRegistry, {
    api: API_TAGS.RESOURCE_REGISTRY.update,
    username,
    language,
    operation: "CREATE_HEALTH_SNAPSHOT",
    reason,
    stepup_session_id: stepupSessionId,
    browser_session_id: browserSessionId,
  });
}

export async function restoreResourceHealthSnapshot({ username, snapshotId, reason, language = DEFAULT_LANGUAGE, stepupSessionId, browserSessionId }: { username: string; snapshotId: string; reason: string; language?: string; stepupSessionId?: string; browserSessionId?: string }) {
  return postEncrypted(API_ROUTES.admin.updateResourceRegistry, {
    api: API_TAGS.RESOURCE_REGISTRY.update,
    username,
    language,
    operation: "RESTORE_HEALTH_SNAPSHOT",
    snapshot_id: snapshotId,
    reason,
    stepup_session_id: stepupSessionId,
    browser_session_id: browserSessionId,
  });
}
