import { describe, expect, it } from "vitest";

import { demoConformanceRun } from "@/fixtures/lumenbazaar";

import { formatDuration, loadDashboardSnapshot, loadSettlementTrends } from "./dashboard";

describe("dashboard snapshot", () => {
  it("uses available API data without inventing unsupported metrics", async () => {
    const snapshot = await loadDashboardSnapshot({
      async getHealth() {
        return {
          app: "api",
          dependencies: {
            database: "configured",
            redis: "configured"
          },
          ok: true,
          service: "lumenbazaar-backend"
        };
      },
      async getLatestConformanceRun() {
        return {
          ...demoConformanceRun,
          id: "api_run"
        };
      },
      async getNetworks() {
        return {
          networks: [
            {
              assets: [],
              displayName: "Stellar Testnet",
              horizonUrl: "https://horizon-testnet.stellar.org",
              id: "stellar:testnet" as const,
              passphrase: "Test SDF Network ; September 2015",
              rpcUrl: "https://soroban-testnet.stellar.org"
            }
          ]
        };
      },
      async listResources() {
        return {
          nextCursor: null,
          resources: []
        };
      }
    });

    expect(snapshot.source).toBe("api");
    expect(snapshot.metrics.indexedResourceCount).toBe(0);
    expect(snapshot.metrics.activeSellerCount).toBeNull();
    expect(snapshot.metrics.settledPaymentCount).toBeNull();
    expect(snapshot.metrics.apiUptimeSeconds).toBeNull();
    expect(snapshot.metrics.supportedNetworks).toEqual(["stellar:testnet"]);
  });

  it("returns an honest unavailable state when API calls fail", async () => {
    const failingClient = {
      getHealth: async () => Promise.reject(new Error("offline")),
      getLatestConformanceRun: async () => Promise.reject(new Error("offline")),
      getNetworks: async () => Promise.reject(new Error("offline")),
      listResources: async () => Promise.reject(new Error("offline"))
    };

    const snapshot = await loadDashboardSnapshot(failingClient);

    expect(snapshot.source).toBe("unavailable");
    expect(snapshot.metrics.indexedResourceCount).toBeNull();
    expect(snapshot.metrics.supportedNetworks).toEqual([]);
    expect(snapshot.metrics.latestConformanceStatus).toBe("unavailable");
    expect(snapshot.warnings.toSorted()).toEqual(
      ["resources", "health", "networks", "conformance"].toSorted()
    );
  });

  it("uses fixture metrics only in explicit demo mode", async () => {
    const snapshot = await loadDashboardSnapshot(
      {
        getHealth: async () => Promise.reject(new Error("should not call")),
        getLatestConformanceRun: async () => Promise.reject(new Error("should not call")),
        getNetworks: async () => Promise.reject(new Error("should not call")),
        listResources: async () => Promise.reject(new Error("should not call"))
      },
      "demo"
    );

    expect(snapshot.source).toBe("demo");
    expect(snapshot.metrics.indexedResourceCount).toBeGreaterThan(0);
  });

  it("formats uptime durations for compact metric cards", () => {
    expect(formatDuration(98_400)).toBe("1d 3h");
  });

  it("fails closed when settlement trend aggregates are unavailable", async () => {
    const trends = await loadSettlementTrends({}, "testnet");

    expect(trends.source).toBe("unavailable");
    expect(trends.points).toEqual([]);
    expect(trends.warnings).toEqual(["settlement-trends-unsupported"]);
    expect(trends.windowLabel).toBe("Unavailable");
  });

  it("uses validated server aggregates with their stated window", async () => {
    const trends = await loadSettlementTrends(
      {
        async getSettlementTrends() {
          return {
            generatedAt: "2026-09-02T16:10:00.000Z",
            points: [
              {
                failedCount: 2,
                p50LatencyMs: 400,
                p95LatencyMs: 700,
                settledCount: 18,
                windowEnd: "2026-09-02T00:00:00.000Z",
                windowStart: "2026-09-01T00:00:00.000Z"
              }
            ],
            window: "24h",
            windowLabel: "Last 24 hours, hourly UTC windows"
          };
        }
      },
      "testnet"
    );

    expect(trends.source).toBe("api");
    expect(trends.window).toBe("24h");
    expect(trends.windowLabel).toBe("Last 24 hours, hourly UTC windows");
    expect(trends.points[0]?.p95LatencyMs).toBe(700);
    expect(trends.partial).toBe(false);
  });

  it("rejects invalid aggregate payloads instead of implying zero incidents", async () => {
    const trends = await loadSettlementTrends(
      {
        async getSettlementTrends() {
          return { points: [] };
        }
      },
      "testnet"
    );

    expect(trends.source).toBe("unavailable");
    expect(trends.points).toEqual([]);
    expect(trends.warnings).toEqual(["settlement-trends-invalid"]);
  });

  it("labels explicit demo aggregates and incomplete windows", async () => {
    const trends = await loadSettlementTrends({}, "demo");

    expect(trends.source).toBe("demo");
    expect(trends.windowLabel).toContain("UTC");
    expect(trends.points.length).toBeGreaterThan(0);
    expect(trends.partial).toBe(true);
    expect(trends.warnings).toContain("settlement-trends-incomplete-windows");
  });
});
