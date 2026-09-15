import { API_ROUTES, API_TAGS, DEFAULT_LANGUAGE } from "../config/appConfig";
import { postEncrypted } from "./sharedEncryptedRequest";

export async function getWorkflowOrgPolicies({ username, orgId, language = DEFAULT_LANGUAGE }: { username: string; orgId: string; language?: string }) {
  return postEncrypted(API_ROUTES.admin.getOrgSettings, {
    api: API_TAGS.ORG_SETTINGS.get,
    username,
    language,
    org_id: orgId,
    operation: "WORKFLOW_POLICIES_GET",
  });
}

export async function saveWorkflowOrgPolicies({ username, orgId, workflowPolicies, expectedVersion, language = DEFAULT_LANGUAGE }: { username: string; orgId: string; workflowPolicies: Record<string, any>; expectedVersion?: number; language?: string }) {
  return postEncrypted(API_ROUTES.admin.upsertOrgSettings, {
    api: API_TAGS.ORG_SETTINGS.upsert,
    username,
    language,
    org_id: orgId,
    operation: "WORKFLOW_POLICIES_UPDATE",
    resource_key: "workflow_policies.edit",
    action: "UPDATE",
    workflow_policies: workflowPolicies,
    expected_version: expectedVersion,
  });
}

export async function getWorkflowMandiPolicies({ username, orgId, mandiId, language = DEFAULT_LANGUAGE }: { username: string; orgId: string; mandiId: string; language?: string }) {
  return postEncrypted(API_ROUTES.admin.getMandiSettings, {
    api: API_TAGS.MANDI_SETTINGS.get,
    username,
    language,
    org_id: orgId,
    mandi_id: mandiId,
    operation: "WORKFLOW_POLICIES_GET",
  });
}

export async function getWorkflowMandiSummary({ username, orgId, language = DEFAULT_LANGUAGE }: { username: string; orgId: string; language?: string }) {
  return postEncrypted(API_ROUTES.admin.getMandiSettings, {
    api: API_TAGS.MANDI_SETTINGS.get,
    username,
    language,
    org_id: orgId,
    operation: "WORKFLOW_POLICIES_SUMMARY",
  });
}

export async function saveWorkflowMandiPolicies({ username, orgId, mandiId, workflowPolicies, inheritModes, expectedVersion, language = DEFAULT_LANGUAGE }: { username: string; orgId: string; mandiId: string; workflowPolicies: Record<string, any>; inheritModes: string[]; expectedVersion?: number; language?: string }) {
  return postEncrypted(API_ROUTES.admin.upsertMandiSettings, {
    api: API_TAGS.MANDI_SETTINGS.upsert,
    username,
    language,
    org_id: orgId,
    mandi_id: mandiId,
    operation: "WORKFLOW_POLICIES_UPDATE",
    resource_key: "workflow_policies.edit",
    action: "UPDATE",
    workflow_policies: workflowPolicies,
    inherit_modes: inheritModes,
    expected_version: expectedVersion,
  });
}
