import { z } from "zod";

import { apiClient, type LumenBazaarApiClient } from "@/services/api/client";
import { isDemoMode, type RuntimeEnvironment } from "@/config/runtime";
import { demoDashboardMetrics, demoSettlementTrends } from "@/fixtures/lumenbazaar";
import { currentRuntimeMode } from "@/services/runtime-mode";

export type DashboardMetrics = {
  activeSellerCount: number | null;
  apiUptimeSeconds: number | null;
  indexedResourceCount: number | null;
  latestConformanceStatus: string;
  settledPaymentCount: number | null;
  settlementVolumeByNetwork: Record<string, number>;
  supportedNetworks: string[];
};

export type DashboardSnapshot = {
  checkedAt: string;
  metrics: DashboardMetrics;
  source: "api" | "demo" | "partial" | "unavailable";
  warnings: string[];
};

export type SettlementTrendWindow = "24h" | "7d" | "30d";

export type SettlementTrendPoint = {
  failedCount: number | null;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
  settledCount: number | null;
  windowEnd: string;
  windowStart: string;
};

export type SettlementTrends = {
  generatedAt: string;
  partial: boolean;
  points: SettlementTrendPoint[];
  source: "api" | "demo" | "unavailable";
  warnings: string[];
  window: SettlementTrendWindow;
  windowLabel: string;
};

const settlementTrendPointSchema = z
  .object({
    failedCount: z.number().int().min(0).nullable(),
    p50LatencyMs: z.number().min(0).nullable(),
    p95LatencyMs: z.number().min(0).nullable(),
    settledCount: z.number().int().min(0).nullable(),
    windowEnd: z.string().refine(isValidTimestamp),
    windowStart: z.string().refine(isValidTimestamp)
  })
  .strict();

const settlementTrendsAggregateSchema = z
  .object({
    generatedAt: z.string().min(1).optional(),
    points: z.array(settlementTrendPointSchema).min(1),
    window: z.enum(["24h", "7d", "30d"]),
    windowLabel: z.string().min(1)
  })
  .strict();

type SettlementTrendsClient = {
  getSettlementTrends?: () => Promise<unknown>;
};

type SettlementTrendsSource = LumenBazaarApiClient | SettlementTrendsClient;

type DashboardClient = Pick<
  LumenBazaarApiClient,
  "getHealth" | "getLatestConformanceRun" | "getNetworks" | "listResources"
>;

export async function loadDashboardSnapshot(
  client: DashboardClient = apiClient,
  mode: RuntimeEnvironment = currentRuntimeMode()
): Promise<DashboardSnapshot> {
  if (isDemoMode(mode)) {
    return {
      checkedAt: new Date().toISOString(),
      metrics: demoDashboardMetrics,
      source: "demo",
      warnings: []
    };
  }

  const [resourcesResult, healthResult, networksResult, conformanceResult] =
    await Promise.allSettled([
      client.listResources({ limit: 100 }),
      client.getHealth(),
      client.getNetworks(),
      client.getLatestConformanceRun()
    ]);
  const warnings = failedLabels({
    conformance: conformanceResult,
    health: healthResult,
    networks: networksResult,
    resources: resourcesResult
  });
  const resources = resourcesResult.status === "fulfilled" ? resourcesResult.value.resources : null;
  const networks =
    networksResult.status === "fulfilled"
      ? networksResult.value.networks.map((network) => network.id)
      : [];
  const conformanceStatus =
    conformanceResult.status === "fulfilled" ? conformanceResult.value.status : "unavailable";

  return {
    checkedAt: new Date().toISOString(),
    metrics: {
      activeSellerCount: null,
      apiUptimeSeconds: null,
      indexedResourceCount: resources?.length ?? null,
      latestConformanceStatus: conformanceStatus,
      settledPaymentCount: null,
      settlementVolumeByNetwork: {},
      supportedNetworks: networks
    },
    source: warnings.length === 0 ? "api" : warnings.length === 4 ? "unavailable" : "partial",
    warnings
  };
}

function failedLabels(
  results: Record<string, PromiseSettledResult<unknown>>
): DashboardSnapshot["warnings"] {
  return Object.entries(results)
    .filter(([, result]) => result.status === "rejected")
    .map(([label]) => label);
}

/**
 * Loads typed server aggregates for settlement latency and failure trends.
 *
 * Live mode fails closed when the backend contract does not expose an
 * aggregate endpoint or returns an invalid payload. Empty or partial windows
 * stay explicitly unavailable instead of being rendered as zero incidents.
 */
export async function loadSettlementTrends(
  client: SettlementTrendsSource = apiClient,
  mode: RuntimeEnvironment = currentRuntimeMode()
): Promise<SettlementTrends> {
  if (isDemoMode(mode)) {
    return {
      ...demoSettlementTrends,
      partial: hasIncompleteWindows(demoSettlementTrends.points),
      source: "demo",
      warnings: hasIncompleteWindows(demoSettlementTrends.points)
        ? ["settlement-trends-incomplete-windows"]
        : []
    };
  }

  if (!("getSettlementTrends" in client) || typeof client.getSettlementTrends !== "function") {
    return unavailableTrends("settlement-trends-unsupported");
  }

  try {
    const parsed = settlementTrendsAggregateSchema.safeParse(await client.getSettlementTrends());

    if (!parsed.success) {
      return unavailableTrends("settlement-trends-invalid");
    }

    return {
      generatedAt: parsed.data.generatedAt ?? new Date().toISOString(),
      partial: hasIncompleteWindows(parsed.data.points),
      points: parsed.data.points,
      source: "api",
      warnings: hasIncompleteWindows(parsed.data.points)
        ? ["settlement-trends-incomplete-windows"]
        : [],
      window: parsed.data.window,
      windowLabel: parsed.data.windowLabel
    };
  } catch {
    return unavailableTrends("settlement-trends");
  }
}

function unavailableTrends(warning: string): SettlementTrends {
  return {
    generatedAt: new Date().toISOString(),
    partial: false,
    points: [],
    source: "unavailable",
    warnings: [warning],
    window: "7d",
    windowLabel: "Unavailable"
  };
}

function isValidTimestamp(value: string) {
  return !Number.isNaN(Date.parse(value));
}

function hasIncompleteWindows(points: readonly SettlementTrendPoint[]) {
  return points.some(
    (point) =>
      point.failedCount === null ||
      point.settledCount === null ||
      point.p50LatencyMs === null ||
      point.p95LatencyMs === null
  );
}

export function formatDuration(seconds: number) {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  return `${hours}h`;
}
