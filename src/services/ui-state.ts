import { ApiClientError } from "@/services/api/client";

export type UiErrorState = {
  code: string;
  description: string;
  requestId?: string;
  title: string;
};

export type EmptyCollection = "conformance" | "payments" | "resources";

export function normalizeUiError(
  error: unknown,
  fallback: {
    code?: string;
    description: string;
    title: string;
  }
): UiErrorState {
  if (error instanceof ApiClientError) {
    return {
      code: error.code,
      description: error.message,
      requestId: error.requestId,
      title: fallback.title
    };
  }

  if (error instanceof Error) {
    return {
      code: fallback.code ?? "REQUEST_FAILED",
      description: error.message,
      title: fallback.title
    };
  }

  return {
    code: fallback.code ?? "REQUEST_FAILED",
    description: fallback.description,
    title: fallback.title
  };
}

export function emptyStateForCollection(collection: EmptyCollection) {
  switch (collection) {
    case "conformance":
      return {
        description: "Run the backend conformance suite to publish reviewer-facing evidence.",
        title: "No conformance run available"
      };
    case "payments":
      return {
        description: "Verification and settlement activity will appear after paid requests run.",
        title: "No payment attempts loaded"
      };
    case "resources":
      return {
        description:
          "Publish a resource or broaden the filters to include draft and inactive items.",
        title: "No resources loaded"
      };
  }
}

export function redactSensitivePaymentData(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitivePaymentData(item));
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      isSensitivePaymentKey(key) ? "[redacted]" : redactSensitivePaymentData(entry)
    ])
  );
}

export function isSensitivePaymentKey(key: string) {
  const normalized = key.toLowerCase();

  return [
    "authorization",
    "paymentpayload",
    "privatekey",
    "secret",
    "signature",
    "signedxdr",
    "walletaddress",
    "xdr"
  ].some((sensitiveKey) => normalized.includes(sensitiveKey));
}

/**
 * Draft fields a seller can edit. Timestamps and internal status are excluded so
 * autosave bookkeeping never counts as an unsaved change.
 */
export const MEANINGFUL_DRAFT_FIELDS = [
  "name",
  "description",
  "type",
  "url",
  "routeTemplate",
  "network",
  "assetCode",
  "assetIssuer",
  "amount",
  "payTo",
  "inputSchema",
  "outputSchema",
  "extensions"
] as const;

export type ComparableDraft = Partial<Record<(typeof MEANINGFUL_DRAFT_FIELDS)[number], unknown>>;

/**
 * Lists the editable fields whose values differ from the saved baseline.
 * Whitespace-only string edits and key ordering in nested schemas are ignored,
 * so a warning is only shown for changes a seller would recognize.
 */
export function meaningfulDraftChanges(
  draft: ComparableDraft | null | undefined,
  baseline: ComparableDraft | null | undefined
): string[] {
  return MEANINGFUL_DRAFT_FIELDS.filter(
    (field) => stableValue(draft?.[field]) !== stableValue(baseline?.[field])
  );
}

export function hasMeaningfulDraftChanges(
  draft: ComparableDraft | null | undefined,
  baseline: ComparableDraft | null | undefined
): boolean {
  return meaningfulDraftChanges(draft, baseline).length > 0;
}

function stableValue(value: unknown): string {
  return JSON.stringify(normalizeComparableValue(value)) ?? "undefined";
}

function normalizeComparableValue(value: unknown): unknown {
  if (value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  if (Array.isArray(value)) {
    return value.map(normalizeComparableValue);
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, normalizeComparableValue((value as Record<string, unknown>)[key])])
    );
  }

  return value;
}
