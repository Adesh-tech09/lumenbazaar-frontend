import { describe, expect, it } from "vitest";

import type { TelemetryEvent } from "@/services/telemetry/types";

import { loadPaymentActivity, type PaymentActivity } from "./payments";
import {
  createDiagnosticBundle,
  DIAGNOSTIC_TRANSACTION_FIELDS,
  maskDiagnosticIdentifier,
  redactDiagnosticText,
  serializeDiagnosticBundle,
  type DiagnosticBundleInput
} from "./diagnostics";

const seededWallet = "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE";
const seededSecretKey = "SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const seededHash = "a".repeat(64);
const seededEmail = "support.agent@example.com";

function seededActivity(): PaymentActivity {
  const base = loadPaymentActivity({}, "demo").find(
    (item) => item.attempt.id === "attempt_weather_001"
  );

  if (base === undefined) {
    throw new Error("Expected demo payment activity.");
  }

  return {
    ...base,
    attempt: {
      ...base.attempt,
      failureReason: `Contact ${seededEmail} with key ${seededSecretKey}`,
      paymentHash: seededHash
    },
    receipt: base.receipt
      ? {
          ...base.receipt,
          correlationId: "corr_seeded_private_identifier",
          evidenceHash: seededHash,
          transactionHash: seededHash
        }
      : undefined,
    seller: base.seller
      ? {
          ...base.seller,
          walletAddress: seededWallet
        }
      : undefined
  };
}

describe("redacted payment diagnostic bundle", () => {
  it("includes only allowlisted transaction fields", () => {
    const bundle = createDiagnosticBundle({
      appVersion: "0.1.0",
      environment: "demo",
      network: "stellar:testnet",
      transaction: seededActivity()
    });

    expect(bundle.transaction).not.toBeNull();
    expect(Object.keys(bundle.transaction ?? {}).sort()).toEqual(
      [...DIAGNOSTIC_TRANSACTION_FIELDS].sort()
    );
    expect(bundle.transaction).not.toHaveProperty("paymentHash");
    expect(bundle.transaction).not.toHaveProperty("payTo");
    expect(bundle.transaction).not.toHaveProperty("receipt");
    expect(bundle.transaction).not.toHaveProperty("settlement");
    expect(bundle.transaction).not.toHaveProperty("seller");
  });

  it("redacts seeded wallet keys, hashes, headers, and free text", () => {
    const input = {
      appVersion: "0.1.0",
      environment: "demo",
      filters: {
        assets: ["USDC"],
        dateFrom: "2026-09-02",
        sellerIds: ["seller_atlas_weather"],
        status: "settled" as const
      },
      headers: {
        authorization: `Bearer ${seededSecretKey}`,
        "content-type": "application/json",
        cookie: "session=cookie-secret-value",
        "x-payment-signature": seededHash,
        "x-request-id": "req_public_correlation"
      },
      network: "stellar:testnet",
      source: "demo" as const,
      topSecret: "top-secret-value",
      transaction: seededActivity()
    } satisfies DiagnosticBundleInput & Record<string, unknown>;
    const bundle = createDiagnosticBundle(input as DiagnosticBundleInput);
    const json = serializeDiagnosticBundle(bundle);

    expect(bundle.headers).not.toHaveProperty("authorization");
    expect(bundle.headers).not.toHaveProperty("cookie");
    expect(bundle.headers).not.toHaveProperty("x-payment-signature");
    expect(json).not.toContain(seededWallet);
    expect(json).not.toContain(seededSecretKey);
    expect(json).not.toContain(seededHash);
    expect(json).not.toContain(seededEmail);
    expect(json).not.toContain("cookie-secret-value");
    expect(json).not.toContain("top-secret-value");
    expect(json).toContain("[redacted-hash]");
    expect(json).toContain("[redacted-email]");
    expect(json).toContain("[redacted-stellar-key]");
    expect(json).toContain("req_public_correlation");
    expect(json).toContain("application/json");
  });

  it("extracts only allowlisted telemetry fields and context", () => {
    const event = {
      context: {
        deploymentId: seededWallet,
        networkId: "stellar:testnet",
        sessionId: "session-seeded-private"
      },
      data: {
        authorization: `Bearer ${seededSecretKey}`,
        duration_ms: 120,
        errorCategory: "SETTLEMENT_FAILED",
        secret: "telemetry-secret",
        type: "settlement_failed"
      },
      eventType: "settlement_failed",
      timestamp: Date.UTC(2026, 8, 2, 16, 0, 0)
    } as unknown as TelemetryEvent;
    const bundle = createDiagnosticBundle({
      appVersion: "0.1.0",
      environment: "demo",
      network: "stellar:testnet",
      telemetryEvents: [event]
    });

    expect(bundle.telemetryEvents).toHaveLength(1);
    expect(bundle.telemetryEvents[0]).toEqual({
      data: {
        duration_ms: 120,
        errorCategory: "SETTLEMENT_FAILED"
      },
      eventType: "settlement_failed",
      networkId: "stellar:testnet",
      timestamp: "2026-09-02T16:00:00.000Z"
    });

    const json = serializeDiagnosticBundle(bundle);
    expect(json).not.toContain("session-seeded-private");
    expect(json).not.toContain("telemetry-secret");
    expect(bundle.telemetryEvents[0]).not.toHaveProperty("context");
  });

  it("masks identifiers and exposes the documented text rules", () => {
    expect(maskDiagnosticIdentifier("attempt_weather_001")).toBe("atte…_001");
    expect(maskDiagnosticIdentifier("short")).toBe("[redacted-identifier]");
    expect(maskDiagnosticIdentifier(null)).toBeNull();

    expect(redactDiagnosticText(seededWallet)).toBe("[redacted-stellar-key]");
    expect(redactDiagnosticText(seededHash)).toBe("[redacted-hash]");
    expect(redactDiagnosticText(`Bearer token-value`)).toBe("Bearer [redacted-token]");
    expect(redactDiagnosticText(seededSecretKey)).toBe("[redacted-stellar-key]");
  });
});
