Goal: Finish backend + admin-panel features for Admin Users (incl. Org Admin creating org users), and lay the foundation for other modules using the existing role/policy engine.

0. Ground Rules for Codex

Do NOT change Mongo validators.
Validators are already defined in the database and exported to:

tools/db/cibermandi_validators_dump.txt

Always consult the validators dump before designing data structures.

When creating or updating APIs for any collection (e.g. cm_admin_users, cm_orgs, cm_org_mandis, cm_mandis_masters, settlements, payments, etc.), search that file by collection name and follow the $jsonSchema exactly (field names, types, enums).

Do NOT change existing working APIs unless explicitly asked.

POST /api/admin/getAdminUiConfig is already working and should be left as-is, except for minor non-breaking tweaks if necessary.

All new admin APIs must:

Reuse the common authorization helper: src/utils/adminAuthorization.js

Use the policy documents from cm_admin_role_policies.

Use resource_key + action pairs such as admin_users.create/"CREATE".

Front-end (admin-panel) must:

Derive menus and visible actions (buttons, links) from:

/api/admin/getAdminUiConfig

Role policies (if needed on the client side).

Not hardcode role names into UI logic if avoidable.

1. Repo Structure Assumptions

If structure is slightly different, adapt paths but keep concepts the same.

project-root/
  api/ or CiberMandiApi/
    src/
      routes/
      controllers/
      utils/
  web/ or CiberWeb/
    admin-panel/
      src/
        config/
        api/
        pages/
        components/
  tools/
    db/
      cibermandi_validators_dump.txt
      export_validators.js


Codex: If actual paths differ (e.g., CiberMandiApi vs api), detect and adjust all references accordingly.

2. Shared Backend Utilities – Authorization
2.1. src/utils/adminAuthorization.js

This file already exists (it was created/refactored for organisations.js):

Exports:

loadAdminAndRoles(db, username)

resolveRoleSlug(rawRole)
(must match mapping used in getAdminUiConfig.js)

getRolePolicy(db, roleSlug)

authorizeAdminAction(db, username, resourceKey, action, options = {})

Codex tasks:

Open src/utils/adminAuthorization.js and verify it:

Loads admin user from cm_admin_users.

Loads roles from cm_user_roles (or equivalent collection).

Resolves role_slug consistently with getAdminUiConfig.js.

Fetches cm_admin_role_policies by role_slug.

Given resourceKey + action, checks if { resource_key: resourceKey, actions: [...] } exists and includes action.

Enforces scope based on rolePolicy.scope:

scope.org_level → GLOBAL, OWN_ORG_ONLY

scope.mandi_level → ALL_MANDIS, OWN_ORG_MANDIS_ONLY, OWN_MANDIS_ONLY

Accepts options:

targetOrgCode

targetOrgId

targetMandiCode

targetMandiId

Ensure it returns a standardized result object, e.g.:

{
  allowed: boolean;
  reason?: string;
  roleSlug: string;
  scope: { org_level: string; mandi_level: string };
  adminUser: any;
  roleDoc: any;
}


Existing organisations.js has already been refactored to use this helper; follow the same pattern for new routes.

3. Phase 1 – Admin Users Backend APIs
3.1. Collections (Codex: read schema from validators file)

Before writing code, open tools/db/cibermandi_validators_dump.txt and locate:

cm_admin_users

cm_user_roles (or equivalent admin-role mapping collection)

cm_admin_role_policies

cm_orgs

cm_org_mandis

Follow all field names, types, required attributes, enums, etc.

3.2. Routing Setup

Route file (create or update if already present):

src/routes/admin/adminUsers.js (or similar pattern under routes/admin).

Wire endpoints:

POST /api/admin/getAdminUsers

POST /api/admin/createAdminUser

POST /api/admin/updateAdminUser

POST /api/admin/deactivateAdminUser

POST /api/admin/resetAdminUserPassword

Use existing routing & middleware patterns already used by /api/admin/getAdminUiConfig.

3.3. Common Handler Patterns

All handlers must:

Extract logged-in admin from auth middleware (example: req.user.username or equivalent).

Call authorizeAdminAction with appropriate resource_key + action.

Enforce org and mandi scope based on rolePolicy.scope.

Respond with HTTP 200 and JSON:

return res.status(200).json({
  response: {
    responsecode: '0' or '1',
    description: 'Message...',
  },
  data: { ...optional... }
});


On unauthorized access:

return res.status(200).json({
  response: {
    responsecode: '1',
    description: 'You are not authorized to perform this action.',
  }
});

3.4. POST /api/admin/getAdminUsers

Purpose:

SUPER_ADMIN: list admin users across all orgs, with filters.

ORG_ADMIN / AUDITOR: list admin users only in their org.

Other roles: either no access or restricted, depending on policy.

Authorization:

Call:

const auth = await authorizeAdminAction(
  db,
  currentAdminUsername,
  'admin_users.list',
  'VIEW',
  { targetOrgCode: filters.org_code || null }
);


If !auth.allowed, return unauthorized response.

Request payload (example):

{
  "items": {
    "org_code": "ORG001",     
    "role_slug": "ORG_VIEWER",
    "status": "ACTIVE",       
    "page": 1,
    "page_size": 25
  }
}


For ORG_ADMIN / AUDITOR: ignore/override any org_code passed and force it to their own org.

Response:

{
  "response": {
    "responsecode": "0",
    "description": "Admin users fetched successfully."
  },
  "data": {
    "items": [
      {
        "username": "orgviewer01",
        "display_name": "Org Viewer 01",
        "email": "viewer1@example.com",
        "mobile": "9876543210",
        "role_slug": "ORG_VIEWER",
        "org_code": "ORG001",
        "mandi_codes": ["MANDI42"],
        "is_active": "Y",
        "created_on": "2025-11-27T...",
        "last_login_on": null
      }
    ],
    "page": 1,
    "page_size": 25,
    "total_records": 1
  }
}

3.5. POST /api/admin/createAdminUser

Purpose:

SUPER_ADMIN: create any admin user in any org.

ORG_ADMIN: create admin users only in their own org, and only allowed roles.

Authorization:

Use:

const auth = await authorizeAdminAction(
  db,
  currentAdminUsername,
  'admin_users.create',
  'CREATE',
  { targetOrgCode: payload.org_code }
);


Reject if !auth.allowed.

Role-level business rules:

If auth.roleSlug === 'SUPER_ADMIN': allowed to create any role_slug, any org_code (subject to schema).

If auth.roleSlug === 'ORG_ADMIN':

payload.org_code must equal the admin’s own org_code.

Allowed role_slug set:

const ORG_ADMIN_ALLOWED_ROLES = [
  'ORG_VIEWER',
  'MANDI_ADMIN',
  'MANDI_MANAGER',
  'AUCTIONEER',
  'GATE_OPERATOR',
  'WEIGHBRIDGE_OPERATOR',
  'AUDITOR',
  'VIEWER'
];


If payload.role_slug is not in this list → respond with responsecode '1' and a clear description: "You are not allowed to assign this role.".

Request body (example):

{
  "items": {
    "username": "orgviewer01",
    "password": "SomePassword123", 
    "display_name": "Org Viewer 01",
    "email": "viewer1@example.com",
    "mobile": "9876543210",
    "role_slug": "ORG_VIEWER",
    "org_code": "ORG001",
    "mandi_codes": ["MANDI42", "MANDI43"],
    "is_active": "Y"
  }
}


Implementation details:

Validate all fields against cm_admin_users validator (types, required fields).

Check uniqueness of username in cm_admin_users.

Hash password using existing hashing mechanism used in login (e.g. bcrypt).

Insert new document into cm_admin_users.

Insert role mapping record into cm_user_roles (or equivalent admin role mapping collection) with:

user_id: <cm_admin_users._id>

role_code or role_slug

role_scope (ORG or MANDI depending on role)

org_id or org_code

mandi_ids or mandi_codes if required by schema

audit fields (created_on/by, updated_on/by, is_active)

Return success response with summary data.

3.6. POST /api/admin/updateAdminUser

Purpose:

Update fields like display_name, email, mobile, role_slug, mandi mappings, is_active.

Authorization:

admin_users.edit + "UPDATE" and the same scope rules.

Behavior:

SUPER_ADMIN: can update any user.

ORG_ADMIN: can update only users in their own org and only to allowed roles.

3.7. POST /api/admin/deactivateAdminUser

Purpose:

Soft deactivate user and its role record.

Authorization:

admin_users.deactivate + "DEACTIVATE".

Behavior:

Set is_active: 'N' in cm_admin_users and corresponding role mapping.

3.8. POST /api/admin/resetAdminUserPassword

Purpose:

Reset password of an admin user (e.g. generate a random password or accept one from payload).

Authorization:

admin_users.reset_password + "RESET_PASSWORD".

Behavior:

Update password_hash.

Optionally mark password_last_changed_on.

Respond with a safe confirmation (never echo raw password).

4. Phase 2 – Admin Users UI in Admin Panel

Project: CiberWeb/admin-panel (adjust name if different).

4.1. Types

Create src/types/adminUsers.ts:

export interface AdminUser {
  username: string;
  display_name?: string | null;
  email?: string | null;
  mobile?: string | null;
  role_slug: string;
  org_code?: string | null;
  mandi_codes?: string[];
  is_active: 'Y' | 'N';
  created_on?: string;
  last_login_on?: string | null;
}

4.2. API Layer

Create src/api/adminUsers.ts:

getAdminUsers(filters): Promise<AdminUser[]>

createAdminUser(payload): Promise<...>

updateAdminUser(payload): Promise<...>

deactivateAdminUser(username): Promise<...>

resetAdminUserPassword(username): Promise<...>

Use existing API base URL + tags config (you already have API_BASE_URL set to https://mandiapi.ciberdukaan.com).

4.3. Menu Integration

src/config/menuConfig.ts (or equivalent):

Use the response of /api/admin/getAdminUiConfig which now includes cm_ui_resources & role policies.

Show the Admin Users menu item only if:

The admin_users.menu resource is present and has "VIEW" allowed for the current role.

4.4. Admin Users List Page

Create:

src/pages/admin-users/AdminUsersList.tsx

Features:

Fetch users via getAdminUsers.

Filters:

For SUPER_ADMIN: org dropdown (all org_codes).

For ORG_ADMIN: org fixed to their own org (read-only).

Role filter (all or subset).

Status filter (Active/Inactive).

Table columns:

Username

Display Name

Role

Org

Mandis (comma-separated)

Status (chip)

Actions: View / Edit / Reset Password / Deactivate

Action visibility:

Show “Create User” button if admin_users.create includes "CREATE".

Show “Edit” if admin_users.edit includes "UPDATE".

Show “Deactivate” if admin_users.deactivate includes "DEACTIVATE".

Show “Reset Password” if admin_users.reset_password includes "RESET_PASSWORD".

(Codex: Use existing getAdminUiConfig data to determine these permission flags.)

4.5. Admin User Form (Create/Edit)

Create:

src/pages/admin-users/AdminUserForm.tsx (or local component within list page).

Form fields:

Org:

SUPER_ADMIN: dropdown of all orgs from API.

ORG_ADMIN: fixed to own org, read-only.

Username

Password (for create only)

Display Name

Email

Mobile

Role (role_slug):

SUPER_ADMIN: all role_slugs.

ORG_ADMIN: only allowed roles:

ORG_VIEWER, MANDI_ADMIN, MANDI_MANAGER, AUCTIONEER, GATE_OPERATOR, WEIGHBRIDGE_OPERATOR, AUDITOR, VIEWER.

Mandis:

Multi-select from mandis mapped to this org (via cm_org_mandis → cm_mandis).

On submit:

Call createAdminUser or updateAdminUser with correct payload.

5. Phase 3 – Payments & Settlements (Foundation Only)

Note: This phase can be done after Admin Users are working and roles are testable. This is just to guide future work.

5.1. Backend

Use validators for:

settlements

settlement_lines

payments

APIs to create:

POST /api/admin/getSettlements

Filters: org_code, mandi_id, party_role, status, date range, pagination.

Scoped by role (SUPER_ADMIN vs ORG_ADMIN).

POST /api/admin/getSettlementDetail

Input: settlement_code.

Output:

header (from settlements),

lines (from settlement_lines),

payments (from payments).

POST /api/admin/getPayments

Payments ledger with filters.

(Optional for testing) POST /api/admin/createManualPayment

Attach a manual payment to a settlement to close it or partially pay.

All APIs must use authorizeAdminAction once we define resource_keys like:

billing_orgs.menu, billing_orgs.list, billing_orgs.detail

billing_traders.menu, billing_traders.list, etc.

5.2. Admin Panel UI

Add a “Billing” or “Payments & Settlements” section later with:

Platform Billing (for SUPER_ADMIN).

Org Billing (for ORG_ADMIN).

Settlement list + detail view.

Payments list + detail view.

6. Implementation Order (for Codex)

Confirm adminAuthorization helper is correct and reusable.

Implement Admin Users backend APIs (Section 3).

Implement Admin Users UI (Section 4).

Test full flow:

Login as SUPER_ADMIN → create org(s) / org admins.

Login as ORG_ADMIN → create org-level users for each role.

Login as new roles and verify menus + actions reflect cm_admin_role_policies.

Once stable, proceed with:

Trader Approvals APIs & UI using existing trader_approvals.* resource_keys.

Mandi Prices CRUD using mandi_prices.* keys.

Billing/Payments foundation (Section 5).