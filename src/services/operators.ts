import { apiClient, type LumenBazaarApiClient } from "@/services/api/client";
import type {
  ConformanceRun,
  Health,
  NetworksResponse,
  Readiness,
  SupportedPaymentSchemes,
  Version
} from "@/services/api/schemas";
import { isDemoMode, type RuntimeEnvironment } from "@/config/runtime";
import {
  demoConformanceRun,
  demoHealthRows,
  demoOperatorMetrics,
  demoSupportedPaymentSchemes
} from "@/fixtures/lumenbazaar";
import { currentRuntimeMode } from "@/services/runtime-mode";

export type OperatorHealthStatus = "operational" | "degraded" | "down" | "unknown";

export type NetworkProbeStatus = "operational" | "degraded" | "unavailable" | "unknown";

export type NetworkProbeCheck = {
  checkedAt: string | null;
  detail: string;
  status: NetworkProbeStatus;
};

export type NetworkStatusProbe = {
  backend: NetworkProbeCheck;
  checkedAt: string;
  stellar: NetworkProbeCheck;
};

export type NetworkStatusLevel =
  | "operational"
  | "offline"
  | "degraded"
  | "unverifiable"
  | "checking";

export type NetworkStatusAssessment = {
  backend: NetworkProbeCheck;
  browser: {
    observedAt: string;
    status: "online" | "offline";
  };
  level: NetworkStatusLevel;
  stellar: NetworkProbeCheck;
};

export type OperatorHealthRow = {
  checkedAt: string;
  detail: string;
  name: "API" | "Worker" | "Search" | "Redis" | "Postgres" | "RPC" | "Horizon";
  status: OperatorHealthStatus;
};

export type OperatorSnapshot = {
  checkedAt: string;
  conformance: ConformanceRun | null;
  healthRows: OperatorHealthRow[];
  metrics: {
    queueDepth: Record<string, number | null>;
    settlementLatencyP95Ms: number | null;
    settlementSuccessRate: number | null;
  };
  networks: NetworksResponse["networks"];
  source: "api" | "demo" | "partial" | "unavailable";
  supported: SupportedPaymentSchemes;
  version: Version | null;
  warnings: string[];
};

type OperatorClient = Pick<
  LumenBazaarApiClient,
  | "getHealth"
  | "getLatestConformanceRun"
  | "getNetworks"
  | "getReadiness"
  | "getSupported"
  | "getVersion"
>;

type NetworkProbeClient = Pick<LumenBazaarApiClient, "getHealth" | "getReadiness">;

export async function loadOperatorSnapshot(
  client: OperatorClient = apiClient,
  mode: RuntimeEnvironment = currentRuntimeMode()
): Promise<OperatorSnapshot> {
  if (isDemoMode(mode)) {
    const checkedAt = new Date().toISOString();
    return {
      checkedAt,
      conformance: demoConformanceRun,
      healthRows: demoOperatorHealthRows(),
      metrics: demoOperatorMetrics,
      networks: demoNetworks(),
      source: "demo",
      supported: demoSupportedPaymentSchemes,
      version: {
        commit: "demo-build",
        environment: "demo",
        service: "lumenbazaar-backend",
        version: "0.1.0"
      },
      warnings: []
    };
  }

  const checkedAt = new Date().toISOString();
  const [health, readiness, networksResponse, supported, conformance, version] =
    await Promise.allSettled([
      client.getHealth(),
      client.getReadiness(),
      client.getNetworks(),
      client.getSupported(),
      client.getLatestConformanceRun(),
      client.getVersion()
    ]);
  const networks = networksResponse.status === "fulfilled" ? networksResponse.value.networks : [];
  const results = {
    health,
    readiness,
    networks: networksResponse,
    supported,
    conformance,
    version
  };
  const unavailable = Object.entries(results)
    .filter(([, result]) => result.status === "rejected")
    .map(([name]) => name);
  const successful = Object.keys(results).length - unavailable.length;

  return {
    checkedAt,
    conformance: conformance.status === "fulfilled" ? conformance.value : null,
    healthRows: liveHealthRows(
      health.status === "fulfilled" ? health.value : undefined,
      readiness.status === "fulfilled" ? readiness.value : undefined,
      { networks },
      checkedAt
    ),
    metrics: {
      queueDepth: { "settlement-confirmation": null },
      settlementLatencyP95Ms: null,
      settlementSuccessRate: null
    },
    networks,
    source: successful === 0 ? "unavailable" : unavailable.length === 0 ? "api" : "partial",
    supported:
      supported.status === "fulfilled"
        ? supported.value
        : { extensions: [], kinds: [], signers: {} },
    version: version.status === "fulfilled" ? version.value : null,
    warnings: [...unavailable, "metrics"]
  };
}

/**
 * Read-only connectivity probe for the global status banner.
 *
 * It intentionally performs GET requests only. Recovery uses this probe and
 * never replays payment verification, settlement, or any other mutation.
 */
export async function probeNetworkStatus(
  client: NetworkProbeClient = apiClient,
  mode: RuntimeEnvironment = currentRuntimeMode()
): Promise<NetworkStatusProbe> {
  const checkedAt = new Date().toISOString();

  if (isDemoMode(mode)) {
    return {
      backend: {
        checkedAt,
        detail: "Explicit demo mode; backend readiness is bundled, not probed.",
        status: "operational"
      },
      checkedAt,
      stellar: {
        checkedAt,
        detail: "Explicit demo mode; Stellar readiness is bundled, not probed.",
        status: "operational"
      }
    };
  }

  const [health, readiness] = await Promise.allSettled([client.getHealth(), client.getReadiness()]);

  let backend: NetworkProbeCheck;
  if (health.status === "fulfilled" && health.value.ok) {
    backend = {
      checkedAt,
      detail: `${health.value.service} responded for ${health.value.app}.`,
      status: "operational"
    };
  } else if (health.status === "fulfilled") {
    backend = {
      checkedAt,
      detail: "The backend health check reported an unhealthy service.",
      status: "unavailable"
    };
  } else if (readiness.status === "fulfilled") {
    backend = {
      checkedAt,
      detail: "Health is unavailable, but backend readiness responded.",
      status: "degraded"
    };
  } else {
    backend = {
      checkedAt,
      detail: "The backend health and readiness checks could not be reached.",
      status: "unavailable"
    };
  }

  if (readiness.status === "fulfilled" && !readiness.value.ok && backend.status === "operational") {
    backend = {
      checkedAt,
      detail: "The backend reported that it is not ready to serve payments.",
      status: "degraded"
    };
  }

  let stellar: NetworkProbeCheck;
  if (readiness.status === "rejected") {
    stellar = {
      checkedAt: null,
      detail: "Stellar RPC and Horizon readiness could not be verified.",
      status: "unknown"
    };
  } else {
    const rpc = readiness.value.checks.stellarRpc;
    const horizon = readiness.value.checks.horizon;
    const statuses = [stellarProbeStatus(rpc.status), stellarProbeStatus(horizon.status)];
    const status = statuses.includes("unavailable")
      ? "unavailable"
      : statuses.includes("degraded")
        ? "degraded"
        : "operational";

    stellar = {
      checkedAt,
      detail: `RPC ${probeStatusLabel(rpc.status)}${
        rpc.detail === undefined ? "" : ` (${rpc.detail})`
      }; Horizon ${probeStatusLabel(horizon.status)}${
        horizon.detail === undefined ? "" : ` (${horizon.detail})`
      }.`,
      status
    };
  }

  return { backend, checkedAt, stellar };
}

/**
 * Combines the browser connectivity state with the last read-only probe. The
 * browser source is authoritative for offline state; backend and Stellar
 * checks are never treated as evidence that the browser has a connection.
 */
export function assessNetworkStatus({
  browserObservedAt,
  online,
  probe
}: {
  browserObservedAt: string;
  online: boolean;
  probe: NetworkStatusProbe | undefined;
}): NetworkStatusAssessment {
  const backend: NetworkProbeCheck = online
    ? (probe?.backend ?? {
        checkedAt: null,
        detail: "Backend status checks have not completed yet.",
        status: "unknown"
      })
    : {
        checkedAt: probe?.backend.checkedAt ?? null,
        detail: "Backend checks pause while the browser is offline.",
        status: "unknown"
      };
  const stellar: NetworkProbeCheck = online
    ? (probe?.stellar ?? {
        checkedAt: null,
        detail: "Stellar status checks have not completed yet.",
        status: "unknown"
      })
    : {
        checkedAt: probe?.stellar.checkedAt ?? null,
        detail: "Stellar checks pause while the browser is offline.",
        status: "unknown"
      };

  let level: NetworkStatusLevel;
  if (!online) {
    level = "offline";
  } else if (probe === undefined) {
    level = "checking";
  } else if (
    [backend.status, stellar.status].some(
      (status) => status === "degraded" || status === "unavailable"
    )
  ) {
    level = "degraded";
  } else if ([backend.status, stellar.status].some((status) => status === "unknown")) {
    level = "unverifiable";
  } else {
    level = "operational";
  }

  return {
    backend,
    browser: { observedAt: browserObservedAt, status: online ? "online" : "offline" },
    level,
    stellar
  };
}

/**
 * Stable announcement key. Timestamps are deliberately excluded so repeated
 * polls of the same state do not re-announce to screen readers.
 */
export function networkAnnouncementKey(assessment: NetworkStatusAssessment) {
  if (assessment.level === "checking") return "";
  if (assessment.level === "offline") return "offline";
  return `${assessment.level}:${assessment.backend.status}:${assessment.stellar.status}`;
}

/**
 * Returns the next announcement only when the state changed. The first healthy
 * check stays silent, and recovery is announced only after a prior notice.
 */
export function nextNetworkAnnouncement(
  previousKey: string | null,
  assessment: NetworkStatusAssessment
): { key: string; message: string } | null {
  const key = networkAnnouncementKey(assessment);

  if (key === "" || key === previousKey) return null;
  if (assessment.level === "operational" && previousKey === null) return null;

  const message = networkAnnouncementMessage(assessment);
  return message === "" ? null : { key, message };
}

export function networkAnnouncementMessage(assessment: NetworkStatusAssessment) {
  if (assessment.level === "offline") {
    return "Offline. Browser network access is unavailable; payment and settlement actions need a connection.";
  }

  if (assessment.level === "degraded") {
    return `Degraded service checks. Backend: ${assessment.backend.detail} Stellar: ${assessment.stellar.detail}`;
  }

  if (assessment.level === "unverifiable") {
    return "Service checks could not be verified. Treat payment capabilities as unavailable.";
  }

  if (assessment.level === "operational") {
    return "Connection restored. Backend and Stellar checks are operational.";
  }

  return "";
}

export function conformanceEndpointStatus(
  run: ConformanceRun,
  endpoint: ConformanceRun["results"][number]["endpoint"]
) {
  const results = run.results.filter((result) => result.endpoint === endpoint);

  if (results.some((result) => result.status === "failed")) {
    return "failed";
  }

  if (results.some((result) => result.status === "passed")) {
    return "passed";
  }

  if (results.some((result) => result.status === "reserved")) {
    return "reserved";
  }

  return "missing";
}

export function statusTone(status: OperatorHealthStatus | ConformanceRun["status"] | "reserved") {
  if (status === "operational" || status === "passed") {
    return "success";
  }

  if (status === "degraded" || status === "reserved") {
    return "warning";
  }

  if (status === "unknown") return "neutral";

  return "danger";
}

function liveHealthRows(
  health: Health | undefined,
  readiness: Readiness | undefined,
  networks: NetworksResponse,
  checkedAt: string
): OperatorHealthRow[] {
  const apiStatus: OperatorHealthStatus =
    health === undefined ? "unknown" : health.ok ? "operational" : "down";
  const configuredNetworks = networks.networks.length;

  return [
    {
      checkedAt,
      detail:
        health === undefined
          ? "API health could not be verified."
          : `${health.service} responded for ${health.app}.`,
      name: "API",
      status: apiStatus
    },
    {
      checkedAt,
      detail: "Worker queue telemetry is unavailable through the JSON API.",
      name: "Worker",
      status: "unknown"
    },
    {
      checkedAt,
      detail:
        readiness === undefined
          ? "Search readiness could not be verified."
          : "Search follows backend readiness.",
      name: "Search",
      status: readiness === undefined ? "unknown" : readiness.ok ? "operational" : "down"
    },
    {
      checkedAt,
      detail: readiness?.checks.redis.detail ?? "Redis readiness is unavailable.",
      name: "Redis",
      status: readiness === undefined ? "unknown" : readinessStatus(readiness.checks.redis.status)
    },
    {
      checkedAt,
      detail: readiness?.checks.database.detail ?? "Database readiness is unavailable.",
      name: "Postgres",
      status:
        readiness === undefined ? "unknown" : readinessStatus(readiness.checks.database.status)
    },
    {
      checkedAt,
      detail:
        readiness?.checks.stellarRpc.detail ??
        `${configuredNetworks} configured Stellar RPC endpoint(s).`,
      name: "RPC",
      status:
        readiness === undefined ? "unknown" : readinessStatus(readiness.checks.stellarRpc.status)
    },
    {
      checkedAt,
      detail:
        readiness?.checks.horizon.detail ??
        `${configuredNetworks} configured Stellar Horizon endpoint(s).`,
      name: "Horizon",
      status: readiness === undefined ? "unknown" : readinessStatus(readiness.checks.horizon.status)
    }
  ];
}

function readinessStatus(
  status: Readiness["checks"][keyof Readiness["checks"]]["status"]
): OperatorHealthStatus {
  if (status === "ready") return "operational";
  if (status === "not_required") return "degraded";
  return "down";
}

function stellarProbeStatus(
  status: Readiness["checks"]["stellarRpc"]["status"]
): NetworkProbeStatus {
  if (status === "ready") return "operational";
  if (status === "not_required") return "degraded";
  return "unavailable";
}

function probeStatusLabel(status: Readiness["checks"]["stellarRpc"]["status"]) {
  if (status === "ready") return "ready";
  if (status === "not_required") return "not configured";
  return "unavailable";
}

function demoOperatorHealthRows(): OperatorHealthRow[] {
  return demoHealthRows.map((row) => ({
    ...row,
    name: row.name as OperatorHealthRow["name"],
    status: row.status as OperatorHealthStatus
  }));
}

function demoNetworks(): NetworksResponse["networks"] {
  return demoSupportedPaymentSchemes.kinds.map((kind) => ({
    assets: (kind.extra?.assets ?? []).map((asset) => ({
      code: asset.code,
      decimals: asset.decimals,
      issuer: asset.issuer
    })),
    displayName: kind.network === "stellar:testnet" ? "Stellar Testnet" : "Stellar Public Network",
    horizonUrl:
      kind.network === "stellar:testnet"
        ? "https://horizon-testnet.stellar.org"
        : "https://horizon.stellar.org",
    id: kind.network,
    passphrase:
      kind.network === "stellar:testnet"
        ? "Test SDF Network ; September 2015"
        : "Public Global Stellar Network ; September 2015",
    rpcUrl:
      kind.network === "stellar:testnet"
        ? "https://soroban-testnet.stellar.org"
        : "https://mainnet.sorobanrpc.com"
  }));
}
