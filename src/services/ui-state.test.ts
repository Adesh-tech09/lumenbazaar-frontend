import { describe, expect, it } from "vitest";

import { ApiClientError } from "@/services/api/client";

import {
  emptyStateForCollection,
  hasMeaningfulDraftChanges,
  isSensitivePaymentKey,
  meaningfulDraftChanges,
  normalizeUiError,
  redactSensitivePaymentData
} from "./ui-state";

describe("UI state hardening", () => {
  it("normalizes API errors with stable machine-readable codes", () => {
    const state = normalizeUiError(
      new ApiClientError({
        code: "RESOURCE_NOT_FOUND",
        message: "Missing resource.",
        requestId: "req_1",
        status: 404
      }),
      {
        description: "Fallback",
        title: "Resource unavailable"
      }
    );

    expect(state).toEqual({
      code: "RESOURCE_NOT_FOUND",
      description: "Missing resource.",
      requestId: "req_1",
      title: "Resource unavailable"
    });
  });

  it("provides reusable empty-state copy", () => {
    expect(emptyStateForCollection("payments").title).toBe("No payment attempts loaded");
    expect(emptyStateForCollection("conformance").description).toContain("conformance");
  });

  it("redacts payment payloads and wallet data recursively", () => {
    const redacted = redactSensitivePaymentData({
      nested: {
        paymentPayload: {
          authorization: "signed payload"
        },
        publicMemo: "safe"
      },
      walletAddress: "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE"
    });

    expect(redacted).toEqual({
      nested: {
        paymentPayload: "[redacted]",
        publicMemo: "safe"
      },
      walletAddress: "[redacted]"
    });
    expect(isSensitivePaymentKey("signedXdr")).toBe(true);
  });
});

describe("seller draft dirty state", () => {
  const baseline = {
    amount: "0.05",
    description: "Weather data",
    extensions: { b: 2, a: 1 },
    name: "Weather",
    type: "http",
    url: "https://example.test/weather"
  };

  it("ignores whitespace-only edits and key ordering", () => {
    expect(
      hasMeaningfulDraftChanges(
        { ...baseline, description: "  Weather data  ", extensions: { a: 1, b: 2 } },
        baseline
      )
    ).toBe(false);
  });

  it("reports the fields a seller actually changed", () => {
    expect(meaningfulDraftChanges({ ...baseline, name: "Weather v2" }, baseline)).toEqual(["name"]);
  });

  it("treats timestamps and status as non-meaningful", () => {
    const withBookkeeping = {
      ...baseline,
      createdAt: "later",
      status: "draft",
      updatedAt: "later"
    } as unknown as Parameters<typeof hasMeaningfulDraftChanges>[0];

    expect(hasMeaningfulDraftChanges(withBookkeeping, baseline)).toBe(false);
  });

  it("treats empty and undefined fields as equivalent", () => {
    expect(hasMeaningfulDraftChanges({ url: "" }, {})).toBe(false);
    expect(hasMeaningfulDraftChanges({ url: "https://example.test" }, {})).toBe(true);
  });
});
