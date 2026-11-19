import { describe, expect, it } from "vitest";

import type { PaymentActivity } from "./payments";
import { loadSellerDashboard, summarizeSellerEarnings } from "./seller-dashboard";

describe("seller dashboard", () => {
  it("summarizes seller identity, resources, and recent payments", () => {
    const dashboard = loadSellerDashboard("seller_atlas_weather", "demo");

    expect(dashboard.identityStatus).toBe("connected");
    expect(dashboard.verificationStatus).toBe("verified");
    expect(dashboard.resourceCount).toBe(1);
    expect(dashboard.recentPayments).toHaveLength(1);
  });

  it("rejects fixture seller data outside demo mode", () => {
    expect(() => loadSellerDashboard("seller_atlas_weather", "testnet")).toThrow(
      "Bundled fixtures"
    );
  });
});

function activity(
  overrides: Partial<PaymentActivity["attempt"]> = {},
  settlementStatus?: "settled" | "failed" | "pending"
): PaymentActivity {
  const attempt = {
    amount: "1.0000000",
    assetCode: "USDC",
    assetIssuer: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    createdAt: "2026-09-02T16:00:00.000Z",
    network: "stellar:testnet" as const,
    sellerId: "seller_atlas_weather",
    status: "settled" as const,
    ...overrides
  };

  return {
    attempt,
    ...(settlementStatus === undefined
      ? {}
      : {
          settlement: {
            id: `settlement_${attempt.amount}`,
            network: attempt.network,
            paymentAttemptId: "attempt",
            status: settlementStatus
          } as PaymentActivity["settlement"]
        })
  } as PaymentActivity;
}

describe("seller earnings summary", () => {
  it("never combines the same symbol from different issuers", () => {
    const summary = summarizeSellerEarnings([
      activity({ amount: "1.5" }),
      activity({
        amount: "2.25",
        assetIssuer: "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE"
      })
    ]);

    expect(summary.groups).toHaveLength(2);
    expect(summary.groups.map((group) => group.settledTotal)).toEqual(["1.5", "2.25"]);
  });

  it("separates networks and reports the covered time range", () => {
    const summary = summarizeSellerEarnings([
      activity({ createdAt: "2026-09-01T00:00:00.000Z" }),
      activity({ createdAt: "2026-09-03T00:00:00.000Z", network: "stellar:pubnet" })
    ]);

    expect(summary.groups).toHaveLength(2);
    expect(summary.from).toBe("2026-09-01T00:00:00.000Z");
    expect(summary.to).toBe("2026-09-03T00:00:00.000Z");
  });

  it("keeps zero and very large settled totals exact", () => {
    const summary = summarizeSellerEarnings([
      activity({ amount: "0.0000000" }),
      activity({ amount: "9007199254740992.0000001" })
    ]);

    expect(summary.groups[0]?.settledTotal).toBe("9007199254740992.0000001");
  });

  it("counts pending and failed attempts without adding them to settled totals", () => {
    const summary = summarizeSellerEarnings([
      activity({ amount: "1" }),
      activity({ amount: "5", status: "verified" }, "pending"),
      activity({ amount: "7", status: "failed" }, "failed")
    ]);

    expect(summary.groups).toHaveLength(1);
    expect(summary.groups[0]).toMatchObject({
      failedCount: 1,
      pendingCount: 1,
      settledCount: 1,
      settledTotal: "1"
    });
  });

  it("marks an unparseable amount unavailable instead of dropping it", () => {
    const summary = summarizeSellerEarnings([activity({ amount: "not-a-number" })]);

    expect(summary.groups[0]).toMatchObject({ amountUnavailable: true, settledTotal: null });
    expect(summary.unavailable).toBe(true);
  });

  it("returns an empty, available summary without activity", () => {
    expect(summarizeSellerEarnings([])).toEqual({
      from: null,
      groups: [],
      to: null,
      unavailable: false
    });
  });
});
