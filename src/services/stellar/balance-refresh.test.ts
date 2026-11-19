import { describe, expect, it, vi } from "vitest";

import type { Receipt } from "@/services/api/schemas";

import { balanceRefreshKey, refreshBalancesAfterPayment } from "./balance-refresh";

const account = "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE";

const receipt: Receipt = {
  amount: "10",
  assetCode: "USDC",
  assetIssuer: "GBUQWP3BOUZX34ULNQG23RQ6F4BVWBRXM6LSV7XYJJJX34ZPUSC6D6P2",
  correlationId: "corr_1",
  createdAt: "2026-11-19T10:00:00Z",
  evidenceHash: "evidence_1",
  failureCode: null,
  failureReason: null,
  id: "receipt_1",
  ledger: 104,
  network: "stellar:testnet",
  paymentAttemptId: "attempt_1",
  resourceId: null,
  sellerId: null,
  settledAt: "2026-11-19T10:01:00Z",
  status: "finalized",
  transactionHash: "a".repeat(64),
  updatedAt: "2026-11-19T10:01:00Z"
};

const balancesPayload = {
  balances: [
    { asset_type: "native", balance: "42.0000000" },
    {
      asset_code: "USDC",
      asset_issuer: "GBUQWP3BOUZX34ULNQG23RQ6F4BVWBRXM6LSV7XYJJJX34ZPUSC6D6P2",
      asset_type: "credit_alphanum4",
      balance: "90.0000000",
      limit: "1000.0000000"
    }
  ],
  id: account,
  sequence: "1"
};

function response(body: unknown, status = 200) {
  return {
    json: async () => body,
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Server Error"
  } as Response;
}

function ledgerResponse(sequence: number) {
  return response({
    _embedded: {
      records: [{ closed_at: "2026-11-19T10:00:00Z", hash: "ledger-hash", sequence }]
    }
  });
}

const instantSleep = async () => true;

describe("balanceRefreshKey", () => {
  it("keys confirmed ledger evidence", () => {
    expect(balanceRefreshKey(receipt)).toBe(
      `balances:stellar:testnet:${receipt.transactionHash}:104`
    );
  });

  it("has no key for pending or failed receipts", () => {
    expect(balanceRefreshKey({ ...receipt, status: "pending", ledger: null })).toBeUndefined();
    expect(balanceRefreshKey({ ...receipt, status: "failed" })).toBeUndefined();
  });
});

describe("refreshBalancesAfterPayment", () => {
  it("waits for Horizon to close the confirming ledger before reading balances", async () => {
    let ledgerCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/ledgers")) {
        ledgerCalls += 1;
        // First poll: Horizon is one ledger behind the confirmation.
        return ledgerResponse(ledgerCalls === 1 ? 103 : 105);
      }
      return response(balancesPayload);
    });

    const result = await refreshBalancesAfterPayment({
      account,
      deps: { fetchImpl: fetchMock as unknown as typeof fetch, sleep: instantSleep },
      receipt
    });

    expect(result).toMatchObject({
      attempts: 2,
      confirmedLedger: 104,
      observedLedger: 105,
      status: "refreshed"
    });
    expect(result.balances.map((balance) => balance.assetCode)).toEqual(["XLM", "USDC"]);

    const accountCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes("/accounts/"));
    expect(accountCalls).toHaveLength(1);
  });

  it("stops after the bounded request budget when Horizon lags", async () => {
    const fetchMock = vi.fn(async () => ledgerResponse(100));

    const result = await refreshBalancesAfterPayment({
      account,
      deps: {
        fetchImpl: fetchMock as unknown as typeof fetch,
        maxAttempts: 3,
        sleep: instantSleep
      },
      receipt
    });

    expect(result).toMatchObject({
      attempts: 3,
      confirmedLedger: 104,
      observedLedger: 100,
      status: "timeout"
    });
    expect(result.error).toContain("ledger 104");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("reports a failed refresh without retrying forever", async () => {
    const fetchMock = vi.fn(async () => response({}, 500));

    const result = await refreshBalancesAfterPayment({
      account,
      deps: {
        fetchImpl: fetchMock as unknown as typeof fetch,
        maxAttempts: 2,
        sleep: instantSleep
      },
      receipt
    });

    expect(result.status).toBe("failed");
    expect(result.attempts).toBe(2);
    expect(result.error).toContain("Horizon ledger API error");
  });

  it("stops immediately when the request is cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchMock = vi.fn();

    const result = await refreshBalancesAfterPayment({
      account,
      deps: {
        fetchImpl: fetchMock as unknown as typeof fetch,
        signal: controller.signal,
        sleep: instantSleep
      },
      receipt
    });

    expect(result.status).toBe("cancelled");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not poll without confirmed ledger evidence", async () => {
    const fetchMock = vi.fn();

    const result = await refreshBalancesAfterPayment({
      account,
      deps: { fetchImpl: fetchMock as unknown as typeof fetch, sleep: instantSleep },
      receipt: { ...receipt, ledger: null, status: "pending" }
    });

    expect(result.status).toBe("not_applicable");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
