# CiberMandi Admin – Mandi & Gate Roadmap

## Step 3 – Gate Devices & Config
Backend:
- Route: src/routes/admin/gateDevices.js
- Collections: cm_gate_devices, gate_device_configs
- APIs:
  - Gate Devices: get/create/update/deactivate
  - Gate Device Configs: get/create/update/deactivate
- Pattern: AES decrypt → api tag check → checkUserExists → authorizeAdminAction → safeMultiWrite → getMessage → cleanupHandler
- Tags in json/api_verifications.json:
  - gateDevicesApis { list, create, update, deactivate }
  - gateDeviceConfigsApis { list, create, update, deactivate }

Frontend:
- Services: src/services/gateApi.ts (extend for devices & configs)
- Pages:
  - src/pages/gateDevices/index.tsx
  - src/pages/gateDeviceConfigs/index.tsx
- Both: filters, list, create/edit modal, deactivate, gating
- MenuConfig + App.tsx + appConfig entries.

## Step 4 – Gate Ops Viewer
Backend:
- Route: src/routes/admin/gateOps.js
- Collections: gate_pass_tokens, gate_entry_tokens, gate_movements_log, weighment_tickets
- APIs: getGatePassTokens, getGateEntryTokens, getGateMovements, getWeighmentTickets (read-only)

Frontend:
- Pages:
  - src/pages/gateTokens/index.tsx
  - src/pages/gateMovements/index.tsx
  - src/pages/weighmentTickets/index.tsx
- All read-only viewers with filters and role gating.
