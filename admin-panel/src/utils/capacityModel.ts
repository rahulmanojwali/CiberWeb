export const CAPACITY_MODEL_CONSTANTS = {
  ram_per_live_lane_gb: 0.2,
  cpu_per_live_lane: 0.2,
  ram_per_open_lane_gb: 0.05,
  ram_per_100_queued_lots_gb: 0.1,
  cpu_per_100_queued_lots: 0.1,
  ram_per_100_bidders_gb: 0.15,
  cpu_per_100_bidders: 0.1,
  default_os_reserve_percent: 20,
  default_system_reserve_percent: 20,
  default_web_admin_reserve_percent: 20,
  socket_multiplier_shared: 2,
  socket_multiplier_separate: 3,
  open_lane_cpu_divisor: 2,
} as const;

export type CapacityModelInfraProfile = {
  app_server_ram_gb?: number;
  app_server_vcpu?: number;
  db_server_ram_gb?: number;
  db_server_vcpu?: number;
  web_server_ram_gb?: number;
  web_server_vcpu?: number;
  os_reserve_percent?: number;
  system_reserve_percent?: number;
  web_admin_reserve_percent?: number;
  safety_reserve_percent?: number;
  same_machine_or_separate?: string;
  same_machine?: string;
  websocket_shared_or_separate?: string;
};

export type CapacityModelLoadInputs = {
  expected_farmers: number;
  expected_traders: number;
  peak_active_traders: number;
  expected_lots_per_day: number;
  expected_peak_queued_lots: number;
  expected_concurrent_auctions: number;
  growth_buffer_percent: number;
  number_of_mandis: number;
  deployment_type?: string;
  same_machine_or_separate?: string;
  websocket_shared_or_separate?: string;
  usage_profile?: "TESTING" | "SMALL" | "NORMAL" | "HEAVY" | "PEAK_SEASON";
};

function normalizeNumber(value: any): number {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

function floorNonNegative(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.max(0, Math.floor(value));
}

function clampPercent(value: number): number {
  return Math.min(90, Math.max(0, normalizeNumber(value)));
}

function roundTwo(value: number): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Number(num.toFixed(2));
}

function roundUpRam(value: number): number {
  const nonNegative = Math.max(0, Number(value || 0));
  if (nonNegative <= 0) return 1;
  return Math.max(1, Math.ceil(nonNegative * 2) / 2);
}

function roundUpCpu(value: number): number {
  const nonNegative = Math.max(0, Number(value || 0));
  return Math.max(1, Math.ceil(nonNegative));
}

function getUsableInfraPools(infraProfile: CapacityModelInfraProfile) {
  const osReserve = normalizeNumber(infraProfile?.os_reserve_percent);
  const systemReserve = normalizeNumber(infraProfile?.system_reserve_percent);
  const webAdminReserve = normalizeNumber(infraProfile?.web_admin_reserve_percent);
  const fallbackReserve = normalizeNumber(infraProfile?.safety_reserve_percent);
  const apiReservePercent = clampPercent((osReserve || 0) + (systemReserve || 0) + (fallbackReserve || 0));
  const dbReservePercent = clampPercent((osReserve || 0) + (systemReserve || 0) + (fallbackReserve || 0));
  const webReservePercent = clampPercent((osReserve || 0) + (webAdminReserve || 0) + (fallbackReserve || 0));

  const reserveMultiplierApi = Math.max(0, 1 - (apiReservePercent / 100));
  const reserveMultiplierDb = Math.max(0, 1 - (dbReservePercent / 100));
  const reserveMultiplierWeb = Math.max(0, 1 - (webReservePercent / 100));

  const totalReservePercent = clampPercent((osReserve || 0) + (systemReserve || 0) + (webAdminReserve || 0) + (fallbackReserve || 0));

  const appRam = normalizeNumber(infraProfile?.app_server_ram_gb);
  const appCpu = normalizeNumber(infraProfile?.app_server_vcpu);
  const dbRam = normalizeNumber(infraProfile?.db_server_ram_gb);
  const dbCpu = normalizeNumber(infraProfile?.db_server_vcpu);
  const webRam = normalizeNumber(infraProfile?.web_server_ram_gb);
  const webCpu = normalizeNumber(infraProfile?.web_server_vcpu);

  const websocketMode = String(infraProfile?.websocket_shared_or_separate || "SHARED").trim().toUpperCase() || "SHARED";

  return {
    reserve_percent: totalReservePercent,
    usable_api_ram_gb: roundTwo(appRam * reserveMultiplierApi),
    usable_api_vcpu: roundTwo(appCpu * reserveMultiplierApi),
    usable_db_ram_gb: roundTwo(dbRam * reserveMultiplierDb),
    usable_db_vcpu: roundTwo(dbCpu * reserveMultiplierDb),
    usable_web_ram_gb: roundTwo(webRam * reserveMultiplierWeb),
    usable_web_vcpu: roundTwo(webCpu * reserveMultiplierWeb),
    websocket_shared_or_separate: websocketMode,
    reserve_breakdown: {
      os_reserve_percent: osReserve || 0,
      system_reserve_percent: systemReserve || 0,
      web_admin_reserve_percent: webAdminReserve || 0,
      safety_reserve_percent: fallbackReserve || 0,
      api_reserve_percent: apiReservePercent,
      db_reserve_percent: dbReservePercent,
      web_reserve_percent: webReservePercent,
    },
  };
}

export function deriveSafeCapacityFromInfra(infraProfile: CapacityModelInfraProfile) {
  const assumptions = CAPACITY_MODEL_CONSTANTS;
  const pools = getUsableInfraPools(infraProfile || {});

  const apiSafeLiveByRam = floorNonNegative(pools.usable_api_ram_gb / assumptions.ram_per_live_lane_gb);
  const apiSafeLiveByCpu = floorNonNegative(pools.usable_api_vcpu / assumptions.cpu_per_live_lane);
  const apiSafeMaxLiveLanes = Math.min(apiSafeLiveByRam, apiSafeLiveByCpu);

  const apiSafeOpenByRam = floorNonNegative(pools.usable_api_ram_gb / assumptions.ram_per_open_lane_gb);
  const apiSafeOpenByCpu = floorNonNegative(
    pools.usable_api_vcpu / Math.max(assumptions.cpu_per_live_lane / assumptions.open_lane_cpu_divisor, 0.01),
  );
  const apiSafeMaxOpenLanes = Math.max(apiSafeMaxLiveLanes, Math.min(apiSafeOpenByRam, apiSafeOpenByCpu));

  const apiSafeBiddersByRam = floorNonNegative((pools.usable_api_ram_gb / assumptions.ram_per_100_bidders_gb) * 100);
  const apiSafeBiddersByCpu = floorNonNegative((pools.usable_api_vcpu / assumptions.cpu_per_100_bidders) * 100);
  const apiSafeMaxConcurrentBidders = Math.min(apiSafeBiddersByRam, apiSafeBiddersByCpu);

  const dbSafeQueuedByRam = floorNonNegative((pools.usable_db_ram_gb / assumptions.ram_per_100_queued_lots_gb) * 100);
  const dbSafeQueuedByCpu = floorNonNegative((pools.usable_db_vcpu / assumptions.cpu_per_100_queued_lots) * 100);
  const dbSafeMaxTotalQueuedLots = Math.min(dbSafeQueuedByRam, dbSafeQueuedByCpu);

  const dbSafeSupportBiddersByRam = floorNonNegative((pools.usable_db_ram_gb / assumptions.ram_per_100_bidders_gb) * 100);
  const dbSafeSupportBiddersByCpu = floorNonNegative((pools.usable_db_vcpu / assumptions.cpu_per_100_bidders) * 100);
  const dbSafeSupportBidders = Math.min(dbSafeSupportBiddersByRam, dbSafeSupportBiddersByCpu);

  const finalSafeMaxLiveLanes = apiSafeMaxLiveLanes;
  const finalSafeMaxOpenLanes = Math.max(finalSafeMaxLiveLanes, apiSafeMaxOpenLanes);
  const finalSafeMaxTotalQueuedLots = dbSafeMaxTotalQueuedLots;
  const finalSafeMaxConcurrentBidders = Math.min(apiSafeMaxConcurrentBidders, dbSafeSupportBidders);

  const socketMultiplier = pools.websocket_shared_or_separate === "SEPARATE"
    ? assumptions.socket_multiplier_separate
    : assumptions.socket_multiplier_shared;

  const safeSocketConnections = floorNonNegative(finalSafeMaxConcurrentBidders * socketMultiplier);
  const safeBiddersPerLane = finalSafeMaxLiveLanes > 0
    ? Math.floor(finalSafeMaxConcurrentBidders / finalSafeMaxLiveLanes)
    : 0;
  const safeQueuePerLane = finalSafeMaxLiveLanes > 0
    ? Math.floor(finalSafeMaxTotalQueuedLots / finalSafeMaxLiveLanes)
    : 0;

  return {
    usable_api_ram_gb: pools.usable_api_ram_gb,
    usable_api_vcpu: pools.usable_api_vcpu,
    usable_db_ram_gb: pools.usable_db_ram_gb,
    usable_db_vcpu: pools.usable_db_vcpu,
    usable_web_ram_gb: pools.usable_web_ram_gb,
    usable_web_vcpu: pools.usable_web_vcpu,
    reserve_percent: pools.reserve_percent,
    reserve_breakdown: pools.reserve_breakdown,
    final_safe_live_lanes: finalSafeMaxLiveLanes,
    final_safe_open_lanes: finalSafeMaxOpenLanes,
    final_safe_queued_lots: finalSafeMaxTotalQueuedLots,
    final_safe_concurrent_bidders: finalSafeMaxConcurrentBidders,
    safe_socket_connections: safeSocketConnections,
    safe_bidders_per_lane: safeBiddersPerLane,
    safe_queue_per_lane: safeQueuePerLane,
    // aliases matching backend naming currently shown in Section B
    final_safe_max_live_lanes: finalSafeMaxLiveLanes,
    final_safe_max_open_lanes: finalSafeMaxOpenLanes,
    final_safe_max_total_queued_lots: finalSafeMaxTotalQueuedLots,
    final_safe_max_concurrent_bidders: finalSafeMaxConcurrentBidders,
    derived_safe_max_socket_mobile_connections: safeSocketConnections,
    derived_safe_max_bidders_per_lane: safeBiddersPerLane,
    derived_safe_max_queue_per_lane: safeQueuePerLane,
  };
}

export function estimateRequiredInfraFromLoad(loadInputs: CapacityModelLoadInputs) {
  const assumptions = CAPACITY_MODEL_CONSTANTS;
  const usageProfileMultiplierMap: Record<NonNullable<CapacityModelLoadInputs["usage_profile"]>, number> = {
    TESTING: 0.7,
    SMALL: 0.85,
    NORMAL: 1,
    HEAVY: 1.2,
    PEAK_SEASON: 1.4,
  };

  const usageMultiplier = usageProfileMultiplierMap[loadInputs.usage_profile || "NORMAL"] || 1;
  const growthPercent = Math.min(100, Math.max(0, Number(loadInputs.growth_buffer_percent || 0)));
  const growthMultiplier = 1 + (growthPercent / 100);

  const concurrentAuctions = Math.max(1, Number(loadInputs.expected_concurrent_auctions || 0));
  const expectedLotsPerDay = Math.max(0, Number(loadInputs.expected_lots_per_day || 0));
  const peakQueuedLots = Math.max(0, Number(loadInputs.expected_peak_queued_lots || 0));
  const peakActiveTraders = Math.max(0, Number(loadInputs.peak_active_traders || 0));
  const expectedTraders = Math.max(0, Number(loadInputs.expected_traders || 0));
  const totalUsers = Math.max(0, Number(loadInputs.expected_farmers || 0)) + expectedTraders;

  const baseLive = Math.max(1, concurrentAuctions);
  const baseOpen = Math.max(baseLive, Math.ceil(baseLive * 2));
  const baseQueued = Math.max(peakQueuedLots, Math.ceil(expectedLotsPerDay * 0.25));
  const baseBidders = Math.max(peakActiveTraders, Math.ceil(expectedTraders * 0.25));

  const demandLive = Math.ceil(Math.ceil(baseLive * usageMultiplier) * growthMultiplier);
  const demandOpen = Math.ceil(Math.ceil(baseOpen * usageMultiplier) * growthMultiplier);
  const demandQueued = Math.ceil(Math.ceil(baseQueued * usageMultiplier) * growthMultiplier);
  const demandBidders = Math.ceil(Math.ceil(baseBidders * usageMultiplier) * growthMultiplier);

  const recommendedOsReserve = assumptions.default_os_reserve_percent;
  const recommendedSystemReserve = Math.max(assumptions.default_system_reserve_percent, growthPercent);
  const recommendedWebAdminReserve = assumptions.default_web_admin_reserve_percent;

  const apiReservePercent = clampPercent(recommendedOsReserve + recommendedSystemReserve);
  const dbReservePercent = clampPercent(recommendedOsReserve + recommendedSystemReserve);
  const webReservePercent = clampPercent(recommendedOsReserve + recommendedWebAdminReserve);

  const apiReserveMultiplier = Math.max(0.01, 1 - (apiReservePercent / 100));
  const dbReserveMultiplier = Math.max(0.01, 1 - (dbReservePercent / 100));
  const webReserveMultiplier = Math.max(0.01, 1 - (webReservePercent / 100));

  const requiredUsableAppRam = Math.max(
    demandLive * assumptions.ram_per_live_lane_gb,
    demandOpen * assumptions.ram_per_open_lane_gb,
    (demandBidders / 100) * assumptions.ram_per_100_bidders_gb,
  );
  const requiredUsableAppCpu = Math.max(
    demandLive * assumptions.cpu_per_live_lane,
    demandOpen * (assumptions.cpu_per_live_lane / assumptions.open_lane_cpu_divisor),
    (demandBidders / 100) * assumptions.cpu_per_100_bidders,
  );

  const requiredUsableDbRam = Math.max(
    (demandQueued / 100) * assumptions.ram_per_100_queued_lots_gb,
    (demandBidders / 100) * assumptions.ram_per_100_bidders_gb,
  );
  const requiredUsableDbCpu = Math.max(
    (demandQueued / 100) * assumptions.cpu_per_100_queued_lots,
    (demandBidders / 100) * assumptions.cpu_per_100_bidders,
  );

  const webRamBase = 0.5;
  const webRamUserImpact = (totalUsers / 1000) * 0.25;
  const webRamBeforeBuffer = webRamBase + webRamUserImpact;
  const webRamBufferImpact = webRamBeforeBuffer * (growthMultiplier - 1);
  const requiredUsableWebRam = webRamBeforeBuffer + webRamBufferImpact;

  const webCpuBase = 1;
  const webCpuUserImpact = (totalUsers / 2000) * 0.25;
  const webCpuBeforeBuffer = webCpuBase + webCpuUserImpact;
  const webCpuBufferImpact = webCpuBeforeBuffer * (growthMultiplier - 1);
  const requiredUsableWebCpu = webCpuBeforeBuffer + webCpuBufferImpact;

  const rawAppRam = requiredUsableAppRam / apiReserveMultiplier;
  const rawAppCpu = requiredUsableAppCpu / apiReserveMultiplier;
  const rawDbRam = requiredUsableDbRam / dbReserveMultiplier;
  const rawDbCpu = requiredUsableDbCpu / dbReserveMultiplier;
  const rawWebRam = requiredUsableWebRam / webReserveMultiplier;
  const rawWebCpu = requiredUsableWebCpu / webReserveMultiplier;

  const requiredInfra = {
    app_server_ram_gb: roundUpRam(rawAppRam),
    app_server_vcpu: roundUpCpu(rawAppCpu),
    db_server_ram_gb: roundUpRam(rawDbRam),
    db_server_vcpu: roundUpCpu(rawDbCpu),
    web_server_ram_gb: roundUpRam(rawWebRam),
    web_server_vcpu: roundUpCpu(rawWebCpu),
    os_reserve_percent: recommendedOsReserve,
    system_reserve_percent: recommendedSystemReserve,
    web_admin_reserve_percent: recommendedWebAdminReserve,
    deployment_type: loadInputs.deployment_type,
    same_machine_or_separate: loadInputs.same_machine_or_separate,
    websocket_shared_or_separate: loadInputs.websocket_shared_or_separate,
  };

  const derivedFromRecommended = deriveSafeCapacityFromInfra(requiredInfra);

  return {
    required_app_server_ram_gb: requiredInfra.app_server_ram_gb,
    required_app_server_vcpu: requiredInfra.app_server_vcpu,
    required_db_server_ram_gb: requiredInfra.db_server_ram_gb,
    required_db_server_vcpu: requiredInfra.db_server_vcpu,
    required_web_server_ram_gb: requiredInfra.web_server_ram_gb,
    required_web_server_vcpu: requiredInfra.web_server_vcpu,
    recommended_os_reserve_percent: recommendedOsReserve,
    recommended_system_reserve_percent: recommendedSystemReserve,
    recommended_web_admin_reserve_percent: recommendedWebAdminReserve,
    estimated_safe_live_lanes: derivedFromRecommended.final_safe_live_lanes,
    estimated_safe_open_lanes: derivedFromRecommended.final_safe_open_lanes,
    estimated_safe_queued_lots: derivedFromRecommended.final_safe_queued_lots,
    estimated_safe_concurrent_bidders: derivedFromRecommended.final_safe_concurrent_bidders,
    demand_after_buffer_live_lanes: demandLive,
    demand_after_buffer_open_lanes: demandOpen,
    demand_after_buffer_queued_lots: demandQueued,
    demand_after_buffer_concurrent_bidders: demandBidders,
    infra_profile_for_estimate: requiredInfra,
    estimated_capacity_from_recommended_resources: derivedFromRecommended,
    raw_requirements: {
      app_server_ram_gb: rawAppRam,
      app_server_vcpu: rawAppCpu,
      db_server_ram_gb: rawDbRam,
      db_server_vcpu: rawDbCpu,
      web_server_ram_gb: rawWebRam,
      web_server_vcpu: rawWebCpu,
    },
  };
}

/*
Manual consistency check:
- demand: live=1, open=3, queued=100, bidders=100 with 20% buffer
- estimateRequiredInfraFromLoad(...) returns required infra
- deriveSafeCapacityFromInfra(required infra) should return:
  live >= 1, open >= 3, queued >= 100, bidders >= 100
*/
