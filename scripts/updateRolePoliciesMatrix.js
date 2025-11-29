// updateRolePoliciesMatrix.js
// Run inside mongosh:
//
// mongosh --host 10.0.0.135 --port 27017 --authenticationDatabase admin -u admin -p cibermongose
// > load("scripts/updateRolePoliciesMatrix.js")

(function () {
  const opsDb = db.getSiblingDB("cibermandi_ops_IN");

  function ensurePermission(roleSlug, resourceKey, actions, notes) {
    const policy = opsDb.cm_admin_role_policies.findOne({ role_slug: roleSlug });
    if (!policy) {
      print("[WARN] No cm_admin_role_policies doc for role_slug=" + roleSlug);
      return;
    }

    const perms = policy.permissions || [];
    let found = false;
    let changed = false;

    for (let i = 0; i < perms.length; i++) {
      const p = perms[i];
      if (p.resource_key === resourceKey) {
        found = true;
        const set = new Set(p.actions || []);
        actions.forEach(function (a) {
          if (!set.has(a)) {
            set.add(a);
            changed = true;
          }
        });
        const newActions = Array.from(set);
        if (changed) {
          p.actions = newActions;
        }
        if (notes && !p.notes) {
          p.notes = notes;
          changed = true;
        }
        break;
      }
    }

    if (!found) {
      perms.push({
        resource_key: resourceKey,
        actions: actions,
        ...(notes ? { notes: notes } : {})
      });
      changed = true;
    }

    if (changed) {
      opsDb.cm_admin_role_policies.updateOne(
        { _id: policy._id },
        { $set: { permissions: perms } }
      );
      print("[OK] " + roleSlug + " -> " + resourceKey + " [" + actions.join(",") + "]");
    } else {
      print("[SKIP] " + roleSlug + " already ok for " + resourceKey);
    }
  }

  function grantCrudForModule(modKey, crudRoles, viewRoles) {
    const suffixes = [
      { suf: ".menu", actions: ["VIEW"] },
      { suf: ".list", actions: ["VIEW"] },
      { suf: ".detail", actions: ["VIEW"] },
      { suf: ".create", actions: ["CREATE"] },
      { suf: ".edit", actions: ["UPDATE"] },
      { suf: ".deactivate", actions: ["DEACTIVATE"] }
    ];

    suffixes.forEach(function (item) {
      const suf = item.suf;
      const actions = item.actions;

      // roles that can perform CRUD
      crudRoles.forEach(function (role) {
        ensurePermission(role, modKey + suf, actions, "CRUD on " + modKey);
      });

      // view-only roles get VIEW on menu/list/detail
      if (actions.indexOf("VIEW") !== -1) {
        viewRoles.forEach(function (role) {
          ensurePermission(role, modKey + suf, ["VIEW"], "VIEW " + modKey);
        });
      }
    });
  }

  const ALL_ROLES = [
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "ORG_VIEWER",
    "MANDI_ADMIN",
    "MANDI_MANAGER",
    "GATE_OPERATOR",
    "WEIGHBRIDGE_OPERATOR",
    "AUCTIONEER",
    "AUDITOR",
    "VIEWER"
  ];

  // 1. Dashboard – everyone sees it
  ALL_ROLES.forEach(function (role) {
    ensurePermission(role, "dashboard.menu", ["VIEW"], "Dashboard menu");
    ensurePermission(role, "dashboard.view", ["VIEW"], "Dashboard main view");
  });

  // 2. Global/org-level masters
  const globalMasters = [
    "commodities",
    "commodity_products",
    "auction_methods_masters",
    "auction_rounds_masters",
    "cm_mandi_auction_policies"
  ];

  globalMasters.forEach(function (modKey) {
    grantCrudForModule(
      modKey,
      ["SUPER_ADMIN", "ORG_ADMIN"],
      ["ORG_VIEWER", "AUDITOR"]
    );
  });

  // 3. Mandi-level masters
  const mandiMasters = [
    "mandi_facilities",
    "mandi_gates",
    "mandi_hours"
  ];

  mandiMasters.forEach(function (modKey) {
    grantCrudForModule(
      modKey,
      ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
      ["ORG_VIEWER", "AUDITOR", "VIEWER"]
    );
  });

  // 4. Gate masters
  const gateMasters = [
    "gate_entry_reasons_masters",
    "gate_vehicle_types_masters",
    "cm_gate_devices",
    "gate_device_configs"
  ];

  gateMasters.forEach(function (modKey) {
    grantCrudForModule(
      modKey,
      ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
      ["ORG_VIEWER", "AUDITOR"]
    );
  });

  // 5. Gate & Yard ops viewers
  const gateOpsViewOnly = [
    "gate_pass_tokens.view",
    "weighment_tickets.view",
    "gate_movements_log.view"
  ];

  const gateOpsRolesFullView = [
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "MANDI_ADMIN",
    "MANDI_MANAGER",
    "GATE_OPERATOR",
    "WEIGHBRIDGE_OPERATOR",
    "ORG_VIEWER",
    "AUDITOR"
  ];

  gateOpsViewOnly.forEach(function (rk) {
    gateOpsRolesFullView.forEach(function (role) {
      ensurePermission(role, rk, ["VIEW"], "Gate/Yard ops viewer");
    });
    ensurePermission("VIEWER", rk, ["VIEW"], "Gate/Yard ops high-level view");
  });

  // 6. Auction ops viewers (sessions/lots/results)
  const auctionOps = [
    "auction_sessions.menu",
    "auction_sessions.list",
    "auction_sessions.detail",
    "auction_lots.menu",
    "auction_lots.list",
    "auction_lots.detail",
    "auction_results.menu",
    "auction_results.list",
    "auction_results.detail"
  ];

  const auctionViewRoles = [
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "MANDI_ADMIN",
    "MANDI_MANAGER",
    "AUCTIONEER",
    "ORG_VIEWER",
    "AUDITOR"
  ];

  auctionOps.forEach(function (rk) {
    auctionViewRoles.forEach(function (role) {
      ensurePermission(role, rk, ["VIEW"], "Auction ops viewer");
    });
  });

  // 7. Trader & Farmer registries
  const traderFarmerModules = ["traders", "farmers"];

  traderFarmerModules.forEach(function (modKey) {
    grantCrudForModule(
      modKey,
      ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
      ["ORG_VIEWER", "AUDITOR", "VIEWER"]
    );
  });

  // 8. Payments / Subscriptions / Settlements stack
  const paymentConfigModules = [
    "payment_models",
    "org_payment_settings",
    "mandi_payment_settings",
    "commodity_fees",
    "payment_modes",
    "custom_fees",
    "role_custom_fees"
  ];

  // SUPER_ADMIN + ORG_ADMIN can configure all payment masters
  paymentConfigModules.forEach(function (modKey) {
    grantCrudForModule(
      modKey,
      ["SUPER_ADMIN", "ORG_ADMIN"],
      []
    );
  });

  // MANDI_ADMIN config only for mandi-level payment + commodity fees
  ["mandi_payment_settings", "commodity_fees"].forEach(function (modKey) {
    grantCrudForModule(
      modKey,
      ["MANDI_ADMIN"],
      []
    );
  });

  // Viewer-type modules (only menus/list/detail)
  const paymentViewerModules = [
    "subscriptions",
    "subscription_invoices",
    "settlements",
    "payments_log"
  ];

  paymentViewerModules.forEach(function (modKey) {
    ["menu", "list", "detail"].forEach(function (suf) {
      const rk = modKey + "." + suf;
      [
        "SUPER_ADMIN",
        "ORG_ADMIN",
        "MANDI_ADMIN",
        "MANDI_MANAGER",
        "ORG_VIEWER",
        "AUDITOR"
      ].forEach(function (role) {
        ensurePermission(role, rk, ["VIEW"], "Payment/settlement viewer");
      });

      if (modKey === "settlements" || modKey === "payments_log") {
        ensurePermission("VIEWER", rk, ["VIEW"], "High-level finance view");
      }
    });
  });

  print("=== Done updating cm_admin_role_policies matrix (dashboard + new modules) ===");
})();
