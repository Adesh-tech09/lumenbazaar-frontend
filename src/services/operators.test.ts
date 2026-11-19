import { describe, expect, it, vi } from "vitest";

import { demoConformanceRun, demoSupportedPaymentSchemes } from "@/fixtures/lumenbazaar";

import {
  assessNetworkStatus,
  conformanceEndpointStatus,
  loadOperatorSnapshot,
  networkAnnouncementKey,
  nextNetworkAnnouncement,
  probeNetworkStatus,
  type NetworkStatusProbe
} from "./operators";

describe("operator services", () => {
  it("combines verified live metadata without fixture metrics", async () => {
    const snapshot = await loadOperatorSnapshot(
      {
        async getHealth() {
          return {
            app: "api",
            ok: true,
            service: "lumenbazaar-backend"
          };
        },
        async getReadiness() {
          const ready = { status: "ready" as const };
          return {
            capabilities: { exact: true, upto: false },
            checks: {
              assets: ready,
              database: ready,
              horizon: ready,
              migrations: ready,
              redis: ready,
              signer: ready,
              stellarRpc: ready
            },
            environment: "local",
            ok: true
          };
        },
        async getLatestConformanceRun() {
          return demoConformanceRun;
        },
        async getNetworks() {
          return {
            networks: [
              {
                assets: [
                  {
                    code: "USDC",
                    decimals: 7,
                    issuer: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
                  }
                ],
                displayName: "Stellar Testnet",
                horizonUrl: "https://horizon-testnet.stellar.org",
                id: "stellar:testnet" as const,
                passphrase: "Test SDF Network ; September 2015",
                rpcUrl: "https://soroban-testnet.stellar.org"
              }
            ]
          };
        },
        async getSupported() {
          return demoSupportedPaymentSchemes;
        },
        async getVersion() {
          return {
            commit: "abcdef1",
            environment: "local",
            service: "lumenbazaar-backend",
            version: "0.1.0"
          };
        }
      },
      "local"
    );

    expect(snapshot.source).toBe("api");
    expect(snapshot.healthRows.map((row) => row.name)).toContain("API");
    expect(snapshot.supported.kinds[0]?.scheme).toBe("exact");
    expect(snapshot.metrics.settlementSuccessRate).toBeNull();
    expect(snapshot.version?.commit).toBe("abcdef1");
    expect(snapshot.checkedAt).toEqual(expect.any(String));
  });

  it("does not fall back to demo operator data when backend sources fail", async () => {
    const failingClient = {
      getHealth: async () => Promise.reject(new Error("offline")),
      getLatestConformanceRun: async () => Promise.reject(new Error("offline")),
      getNetworks: async () => Promise.reject(new Error("offline")),
      getReadiness: async () => Promise.reject(new Error("offline")),
      getSupported: async () => Promise.reject(new Error("offline")),
      getVersion: async () => Promise.reject(new Error("offline"))
    };

    const snapshot = await loadOperatorSnapshot(failingClient, "testnet");

    expect(snapshot.source).toBe("unavailable");
    expect(snapshot.conformance).toBeNull();
    expect(snapshot.supported.kinds).toEqual([]);
    expect(snapshot.healthRows.every((row) => row.status === "unknown")).toBe(true);
  });

  it("uses fixtures when demo mode is explicit", async () => {
    const snapshot = await loadOperatorSnapshot(
      {
        getHealth: async () => Promise.reject(new Error("should not call")),
        getLatestConformanceRun: async () => Promise.reject(new Error("should not call")),
        getNetworks: async () => Promise.reject(new Error("should not call")),
        getReadiness: async () => Promise.reject(new Error("should not call")),
        getSupported: async () => Promise.reject(new Error("should not call")),
        getVersion: async () => Promise.reject(new Error("should not call"))
      },
      "demo"
    );

    expect(snapshot.source).toBe("demo");
    expect(snapshot.healthRows).toHaveLength(7);
    expect(snapshot.warnings).toEqual([]);
  });

  it("preserves fulfilled live checks during a partial outage", async () => {
    const snapshot = await loadOperatorSnapshot(
      {
        getHealth: async () => ({ app: "api", ok: true, service: "lumenbazaar-backend" }),
        getLatestConformanceRun: async () => Promise.reject(new Error("offline")),
        getNetworks: async () => ({ networks: [] }),
        getReadiness: async () => Promise.reject(new Error("offline")),
        getSupported: async () => ({ extensions: [], kinds: [], signers: {} }),
        getVersion: async () => ({
          environment: "testnet",
          service: "lumenbazaar-backend",
          version: "0.1.0"
        })
      },
      "testnet"
    );

    expect(snapshot.source).toBe("partial");
    expect(snapshot.healthRows.find((row) => row.name === "API")?.status).toBe("operational");
    expect(snapshot.healthRows.find((row) => row.name === "RPC")?.status).toBe("unknown");
    expect(snapshot.warnings).toContain("readiness");
  });

  it("summarizes conformance endpoint status by result severity", () => {
    expect(conformanceEndpointStatus(demoConformanceRun, "/v1/supported")).toBe("passed");
    expect(conformanceEndpointStatus(demoConformanceRun, "/v1/payment-sessions")).toBe("reserved");
    expect(conformanceEndpointStatus(demoConformanceRun, "/v1/missing")).toBe("missing");
  });
});

describe("network status probe", () => {
  const ready = { status: "ready" as const };

  function readiness(overrides: Partial<Record<string, { detail?: string; status: string }>> = {}) {
    return {
      capabilities: { exact: true, upto: false },
      checks: {
        assets: ready,
        database: ready,
        horizon: ready,
        migrations: ready,
        redis: ready,
        signer: ready,
        stellarRpc: ready,
        ...overrides
      } as {
        assets: typeof ready;
        database: typeof ready;
        horizon: typeof ready;
        migrations: typeof ready;
        redis: typeof ready;
        signer: typeof ready;
        stellarRpc: typeof ready;
      },
      environment: "testnet" as const,
      ok: true
    };
  }

  it("reports operational backend and Stellar checks with a timestamp", async () => {
    const probe = await probeNetworkStatus(
      {
        getHealth: async () => ({
          app: "api",
          ok: true,
          service: "lumenbazaar-backend"
        }),
        getReadiness: async () => readiness()
      },
      "testnet"
    );

    expect(probe.backend.status).toBe("operational");
    expect(probe.stellar.status).toBe("operational");
    expect(probe.checkedAt).toEqual(expect.any(String));
    expect(probe.backend.checkedAt).toEqual(probe.checkedAt);
  });

  it("distinguishes Stellar degradation from a healthy backend", async () => {
    const probe = await probeNetworkStatus(
      {
        getHealth: async () => ({
          app: "api",
          ok: true,
          service: "lumenbazaar-backend"
        }),
        getReadiness: async () =>
          readiness({ stellarRpc: { detail: "RPC refused connections", status: "unavailable" } })
      },
      "testnet"
    );

    expect(probe.backend.status).toBe("operational");
    expect(probe.stellar.status).toBe("unavailable");
    expect(probe.stellar.detail).toContain("RPC unavailable");
    expect(probe.stellar.detail).toContain("Horizon ready");
  });

  it("marks backend unreachable without inventing Stellar readiness", async () => {
    const probe = await probeNetworkStatus(
      {
        getHealth: async () => Promise.reject(new Error("offline")),
        getReadiness: async () => Promise.reject(new Error("offline"))
      },
      "testnet"
    );

    expect(probe.backend.status).toBe("unavailable");
    expect(probe.stellar.status).toBe("unknown");
    expect(probe.stellar.checkedAt).toBeNull();
  });

  it("does not probe the network in explicit demo mode", async () => {
    const getHealth = vi.fn();
    const getReadiness = vi.fn();

    const probe = await probeNetworkStatus({ getHealth, getReadiness }, "demo");

    expect(getHealth).not.toHaveBeenCalled();
    expect(getReadiness).not.toHaveBeenCalled();
    expect(probe.backend.status).toBe("operational");
    expect(probe.stellar.status).toBe("operational");
  });
});

describe("network status assessment", () => {
  const probe: NetworkStatusProbe = {
    backend: {
      checkedAt: "2026-11-18T10:00:00.000Z",
      detail: "backend is not ready",
      status: "degraded"
    },
    checkedAt: "2026-11-18T10:00:00.000Z",
    stellar: {
      checkedAt: "2026-11-18T10:00:00.000Z",
      detail: "RPC ready; Horizon ready.",
      status: "operational"
    }
  };

  it("keeps the browser offline state distinct from service degradation", () => {
    const assessment = assessNetworkStatus({
      browserObservedAt: "2026-11-18T10:05:00.000Z",
      online: false,
      probe
    });

    expect(assessment.level).toBe("offline");
    expect(assessment.browser.status).toBe("offline");
    expect(assessment.backend.status).toBe("unknown");
    expect(assessment.backend.detail).toMatch(/pause while the browser is offline/i);
    expect(assessment.backend.checkedAt).toBe(probe.backend.checkedAt);
  });

  it("reports degraded when only Stellar is degraded", () => {
    const assessment = assessNetworkStatus({
      browserObservedAt: "2026-11-18T10:05:00.000Z",
      online: true,
      probe: {
        ...probe,
        backend: { ...probe.backend, status: "operational", detail: "backend responded" },
        stellar: { ...probe.stellar, status: "degraded" }
      }
    });

    expect(assessment.level).toBe("degraded");
    expect(assessment.browser.status).toBe("online");
  });

  it("deduplicates announcements across polls with new timestamps", () => {
    const offline = assessNetworkStatus({
      browserObservedAt: "2026-11-18T10:05:00.000Z",
      online: false,
      probe
    });
    const first = nextNetworkAnnouncement(null, offline);
    const repeated = nextNetworkAnnouncement(first?.key ?? null, offline);

    expect(first?.message).toMatch(/^Offline\./);
    expect(repeated).toBeNull();

    const stillOffline = assessNetworkStatus({
      browserObservedAt: "2026-11-18T10:06:00.000Z",
      online: false,
      probe
    });
    expect(networkAnnouncementKey(stillOffline)).toBe(networkAnnouncementKey(offline));
    expect(nextNetworkAnnouncement(first?.key ?? null, stillOffline)).toBeNull();
  });

  it("announces recovery only after a prior notice", () => {
    const operational = assessNetworkStatus({
      browserObservedAt: "2026-11-18T10:07:00.000Z",
      online: true,
      probe: {
        ...probe,
        backend: { ...probe.backend, status: "operational", detail: "backend responded" }
      }
    });

    expect(nextNetworkAnnouncement(null, operational)).toBeNull();
    expect(nextNetworkAnnouncement("offline", operational)).toEqual({
      key: "operational:operational:operational",
      message: expect.stringMatching(/^Connection restored\./)
    });
  });
});
