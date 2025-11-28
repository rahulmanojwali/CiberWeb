ind existing Mongo helpers in CiberMandiApi (where cibermandi_ops_IN / cibermandi_market_IN connections are created).

Add a new connection helper for billing DB, for example:

getBillingDb(country) or similar, pointing to cibermandi_billing_IN using the new user/URI.

Follow the same pattern: uses tunnel, returns { client, db }, and fits into cleanupHandler.

Expose this helper so that future routes (subscriptions, payments_log) can call it.

Constraint: No API logic yet. Only common connection plumbing.

1.2 Fee-resolution engine (pure service module)

Goal: One backend module that, given (org_id, mandi_id, commodity_id, product_id, fee_codes, payment_mode), returns the effective fee rules by reading:

cm_payment_models

cm_org_payment_settings

cm_mandi_payment_settings

cm_commodity_payment_settings

cm_payment_mode_rules

cm_role_custom_fees (for custom fees)

Tasks for Codex:

Create a new utility module, e.g.:

src/services/paymentFeeResolver.js

Implement a main function, eg:

resolveFees({ orgId, mandiId, commodityId, productId, feeCodes, paymentMode, country })

It should:

Load base model from cm_payment_models (GLOBAL or ORG scope).

Overlay org overrides (cm_org_payment_settings).

Overlay mandi overrides (cm_mandi_payment_settings).

Overlay commodity-level overrides (cm_commodity_payment_settings).

Add payment-mode MDR info from cm_payment_mode_rules.

Attach any active cm_role_custom_fees relevant for this org/mandi.

Return a normalized structure, something like:

{
  fees: [
    {
      fee_code: "MARKET_FEE",
      mode: "PERCENT",
      percent_value: 1.0,
      fixed_value: null,
      source: "MANDI" // or ORG/DEFAULT/COMMODITY
    },
    ...
  ],
  payment_mode_mdr: {
    mode_code: "UPI",
    rule_type: "MDR",
    mode: "PERCENT",
    percent_value: 0.5,
    fixed_value: null
  },
  custom_fees: [
    { custom_fee_code, label, mode, values, applies_to }
  ]
}


No routes call this yet. Just implement + export, and write 1–2 internal helper functions if needed.

PHASE 2 – Admin “Payment Config” APIs (OPS DB only)

Now Codex wires admin APIs so SUPER_ADMIN / ORG_ADMIN / MANDI_ADMIN can configure fee models.

Create a new route file:

src/routes/admin/paymentConfig.js

Use the standard AES pipeline:

decrypt → API tag check → checkUserExists (cm_admin_users) → authorizeAdminAction → do DB logic → getMessage → cleanupHandler

2.1 API tags & resources

Tasks for Codex:

In json/api_verifications.json, add a group like:

"paymentConfigApis": [
  "getPaymentModels",
  "upsertPaymentModel",
  "getOrgPaymentSettings",
  "updateOrgPaymentSettings",
  "getMandiPaymentSettings",
  "updateMandiPaymentSettings",
  "getCommodityPaymentSettings",
  "upsertCommodityPaymentSettings",
  "getPaymentModeRules",
  "upsertPaymentModeRules",
  "getCustomFeeTemplates",
  "upsertCustomFeeTemplate",
  "getRoleCustomFees",
  "upsertRoleCustomFee"
]


In cm_ui_resources & cm_admin_role_policies, add resource keys (just placeholders now; real mapping later):

payment_models.menu, payment_models.list, payment_models.create, payment_models.update

org_payment_settings.*

mandi_payment_settings.*

commodity_payment_settings.*

payment_mode_rules.*

custom_fee_templates.*

role_custom_fees.*

(Only SUPER_ADMIN/ORG_ADMIN/MANDI_ADMIN should get create/update.)

2.2 Implement backend handlers (spec-level)

In paymentConfig.js, Codex needs to define handlers with these behaviours:

POST /api/admin/getPaymentModels

Input: filters (scope, org_id, mandi_id, active flag).

Output: paginated list from cm_payment_models.

POST /api/admin/upsertPaymentModel

Input: full model object (model_code, scope, fees[], etc.).

If new → insert; if existing by model_code + scope → update.

Validate uniqueness per (scope, org_id, mandi_id, model_code).

POST /api/admin/getOrgPaymentSettings

Input: org_id (and country)

Output: current cm_org_payment_settings for that org, if any.

POST /api/admin/updateOrgPaymentSettings

Input: org_id + overrides.

Upsert: create if not exists, else update selective fields.

Track version increment.

POST /api/admin/getMandiPaymentSettings

Input: org_id, mandi_id.

Output: cm_mandi_payment_settings record.

POST /api/admin/updateMandiPaymentSettings

Input: org_id, mandi_id + override & custom_fees[].

Upsert per (org_id, mandi_id) as unique.

POST /api/admin/getCommodityPaymentSettings

Input: org_id, mandi_id, commodity_id, optional product_id.

Output: list of cm_commodity_payment_settings rows.

POST /api/admin/upsertCommodityPaymentSettings

Input: one or more fee rule sets.

Upsert per (org_id, mandi_id, commodity_id, product_id).

POST /api/admin/getPaymentModeRules

Input: org_scope (GLOBAL/ORG), org_id.

Output: cm_payment_mode_rules entries.

POST /api/admin/upsertPaymentModeRules

Upsert based on (org_scope, org_id, mode_code).

POST /api/admin/getCustomFeeTemplates

Output: list from cm_custom_fee_templates.

POST /api/admin/upsertCustomFeeTemplate

Insert or update by custom_fee_code.

POST /api/admin/getRoleCustomFees

Input: org_id, mandi_id.

Output: list from cm_role_custom_fees.

POST /api/admin/upsertRoleCustomFee

Upsert per (org_id, mandi_id, custom_fee_code).

All responses should follow your standard:

res.status(200).json({
  response: {
    responsecode: "0" | "1",
    description: getMessage(code, language),
    data: { ... } // when applicable
  }
});

PHASE 3 – Admin-panel UI for “Payment Config”

Now Codex updates the React admin-panel.

3.1 Menu & routing

Tasks:

In admin-panel/src/config/menuConfig.ts (or equivalent):

Add a parent menu: “Payments & Settlements”.

Children (for now):

“Payment Models” (route /payment-models)

“Org Payment Settings” (/org-payment-settings)

“Mandi Payment Settings” (/mandi-payment-settings)

“Commodity Fee Settings” (/commodity-fees)

“Payment Modes” (/payment-modes)

“Custom Fees” (/custom-fees)

“Role Custom Fees” (/role-custom-fees)

Tie menu visibility to can('payment_models.menu', 'VIEW') etc.

Setup routing entries that map those paths to new pages.

3.2 API client

Create admin-panel/src/services/paymentConfigApi.ts with AES-backed POST functions:

getPaymentModels, upsertPaymentModel, …

Each calls corresponding /api/admin/... route with encrypted payload, exactly like existing auctionMastersApi, mandiMastersApi, etc.

3.3 Pages (one by one)

For each route, build a simple Refine/MUI page:

Payment Models page

DataGrid: model_code, scope, org, mandi, active, version.

Filters: org, mandi, active.

Drawer/dialog for create/edit.

Org Payment Settings page

Filter: org selector.

Form: per-fee override (dropdown mode + values), subscription override, flags.

Read-only feet summary from the model if helpful.

Mandi Payment Settings page

Filter: org + mandi.

Form: fee overrides, custom_fees list (multi-select from templates).

Commodity Fee Settings

Filter: org, mandi, commodity.

DataGrid of fees; support add/edit.

Payment Modes

DataGrid: mode_code, scope, is_allowed.

Edit screen for MDR / cash handling per mode.

Custom Fees

Templates list with add/edit screen (label_i18n, visibility, modes).

Role Custom Fees

Filter: org + mandi.

DataGrid of custom fees active in that mandi; add/edit.

PHASE 4 – Subscription engine APIs (billing DB)

New route file:

src/routes/admin/subscriptions.js

Using billing DB helper from Phase 1 and standard AES pipeline.

4.1 API tag group

Add in json/api_verifications.json:

"subscriptionApis": [
  "getSubscriptions",
  "upsertSubscription",
  "getSubscriptionInvoices",
  "getSubscriptionInvoiceDetail",
  "recordSubscriptionPayment"
]

4.2 Handlers spec

POST /api/admin/getSubscriptions

Filters:

subject_type, org_id, mandi_id, party_code, payer_username, status.

Output: paginated list from cm_subscription_records.

POST /api/admin/upsertSubscription

Input:

subject_type (ORG/MANDI/TRADER/FPO)

org_id, mandi_id, party_code, payer_username

billing_cycle, amount_base, max_discount_percent, status, next_due_on.

Behaviour:

If subscription exists for (subject_type + org_id + mandi_id + party_code) → update.

Else insert new record.

POST /api/admin/getSubscriptionInvoices

Filters:

subscription_id, org_id, subject_type, payment_status, date range.

Output: list from cm_subscription_invoices.

POST /api/admin/getSubscriptionInvoiceDetail

Input: invoice_id.

Output: invoice + any payments from cm_payments_log where source="SUBSCRIPTION" and link_id = invoice_id.

POST /api/admin/recordSubscriptionPayment

Input:

invoice_id, amount, method, payment_ref, payer_username.

Behaviour:

Insert row in cm_payments_log:

source: "SUBSCRIPTION", link_collection: "cm_subscription_invoices", link_id: invoice_id.

Update invoice payment_status (PENDING/PARTIAL/PAID) and paid_on.

No external gateway integration for now – assume payment was done offline and operator is recording.

PHASE 5 – Admin-panel UI for Subscriptions & Payments Log
5.1 Services

Create admin-panel/src/services/subscriptionsApi.ts:

getSubscriptions, upsertSubscription, getSubscriptionInvoices, getSubscriptionInvoiceDetail, recordSubscriptionPayment.

5.2 Pages

Subscriptions page (/subscriptions)

Filters: org, mandi, subject_type, status.

DataGrid: subject_type, org, mandi, party_code, payer_username, billing_cycle, amount_base, status, next_due_on.

Dialog to create/update subscription.

Invoices page (/subscription-invoices)

Filters: org, subject_type, payment_status, date range.

DataGrid: invoice_code, subject, amount_gross, payment_status, due date, paid_on.

Row click → detail drawer with invoice + payments history + “Mark payment” form (opens recordSubscriptionPayment).

Payments Log viewer (optional now or later)

New page payments-log under “Payments & Settlements”.

Read-only DataGrid bound to cm_payments_log once we add route for it.

PHASE 6 – Settlements viewer + linking to cm_payments_log (market DB)

This is the “mandi trade bills” admin screen.

6.1 Backend: settlements.js (read-only)

New route:

src/routes/admin/settlements.js

API tags:

"settlementsApis": [
  "getSettlements",
  "getSettlementDetail"
]


Handlers:

POST /api/admin/getSettlements

Data source:

cibermandi_market_IN.settlements

Filters:

org_id, mandi_id, party_role, party_code, status, date range.

Aggregation:

Lookup cibermandi_market_IN.payments or cibermandi_billing_IN.cm_payments_log (where source="SETTLEMENT") to compute paid_amount and balance.

Response: list + pagination.

POST /api/admin/getSettlementDetail

Settlement header (from settlements).

Lines (from settlement_lines).

Related payments:

both from existing payments (market DB) and from cm_payments_log where source="SETTLEMENT" and link_id = settlement_id.

6.2 Frontend: Settlements viewer

Service:

admin-panel/src/services/settlementsApi.ts with getSettlements, getSettlementDetail.

Page:

Route /settlements under “Payments & Settlements”.

DataGrid: settlement_code, org, mandi, party_role, party_code, total_amount, paid_amount, balance, status.

Row click opens a detail drawer:

Header info

Lines table

Payments history (source, method, amount, status).

That’s the roadmap.  You already have the access of the 
“Implement PHASE 1.1 now”

Then “PHASE 1.2”, etc. and rest of the PHASES .. 