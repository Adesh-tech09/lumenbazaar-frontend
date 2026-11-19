import { describe, expect, it } from "vitest";

import type { Receipt } from "@/services/api/schemas";

import {
  buildReceiptSharePlan,
  isMinimumReceiptShareLink,
  receiptShareExcludedFields
} from "./receipt-share";

const receipt: Receipt = {
  amount: "12.5",
  assetCode: "USDC",
  assetIssuer: "GBUQWP3BOUZX34ULNQG23RQ6F4BVWBRXM6LSV7XYJJJX34ZPUSC6D6P2",
  correlationId: "corr_private_123",
  createdAt: "2026-11-19T10:00:00Z",
  evidenceHash: "evidence_private_456",
  failureCode: null,
  failureReason: null,
  id: "receipt_weather_001",
  ledger: 123456,
  network: "stellar:testnet",
  paymentAttemptId: "attempt_private_789",
  resourceId: "resource_private_1",
  sellerId: "seller_private_2",
  settledAt: "2026-11-19T10:01:00Z",
  status: "finalized",
  transactionHash: "a".repeat(64),
  updatedAt: "2026-11-19T10:01:00Z"
};

describe("buildReceiptSharePlan", () => {
  it("builds a link containing only the receipt reference", () => {
    const plan = buildReceiptSharePlan(receipt, "https://lumenbazaar.example/");

    expect(plan.path).toBe("/receipts/receipt_weather_001");
    expect(plan.url).toBe("https://lumenbazaar.example/receipts/receipt_weather_001");
    expect(plan.linkFields).toEqual([{ label: "Receipt reference", value: "receipt_weather_001" }]);
    expect(isMinimumReceiptShareLink(plan.url)).toBe(true);
  });

  it("never includes private payment, correlation, or wallet data", () => {
    const plan = buildReceiptSharePlan(receipt, "https://lumenbazaar.example");
    const serialized = `${plan.url} ${JSON.stringify(plan.linkFields)}`;

    expect(serialized).not.toContain(receipt.paymentAttemptId);
    expect(serialized).not.toContain(receipt.correlationId);
    expect(serialized).not.toContain(receipt.evidenceHash);
    expect(plan.excludedFields).toEqual(receiptShareExcludedFields);
  });

  it("names the fields the recipient can see on the receipt page", () => {
    const plan = buildReceiptSharePlan(receipt);

    expect(plan.recipientVisibleFields).toEqual([
      { label: "Receipt status", value: "finalized" },
      { label: "Network", value: "stellar:testnet" },
      { label: "Amount and asset", value: "12.5 USDC" }
    ]);
  });

  it("encodes identifiers that contain reserved characters", () => {
    const plan = buildReceiptSharePlan(
      { ...receipt, id: "receipt/1?private=true#frag" },
      "https://lumenbazaar.example"
    );

    expect(plan.path).toBe("/receipts/receipt%2F1%3Fprivate%3Dtrue%23frag");
    expect(isMinimumReceiptShareLink(plan.url)).toBe(true);
  });
});
