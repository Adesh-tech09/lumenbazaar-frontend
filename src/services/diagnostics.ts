import { EVENT_ALLOWLIST } from "@/services/telemetry/allowlist";
import type { TelemetryEvent } from "@/services/telemetry/types";
import type { PaymentActivity, PaymentActivityFilters } from "@/services/payments";

/**
 * Redacted payment diagnostic bundle.
 *
 * The bundle is assembled from an explicit allowlist: unknown input fields are
 * never spread into the output. Free-text values pass through documented
 * redaction rules, and sensitive headers are never copied.
 */

export const DIAGNOSTIC_HEADER_ALLOWLIST = [
  "content-type",
  "x-request-id",
  "x-correlation-id",
  "x-ratelimit-remaining"
] as const;

export const DIAGNOSTIC_TRANSACTION_FIELDS = [
  "attemptId",
  "createdAt",
  "network",
  "assetCode",
  "amount",
  "status",
  "sellerId",
  "resourceId",
  "failureCode",
  "failureReason",
  "receiptId",
  "receiptStatus",
  "transactionHash",
  "correlationId",
  "settlementId",
  "ledger"
] as const;

export const DIAGNOSTIC_FILTER_FIELDS = [
  "network",
  "status",
  "assets",
  "asset",
  "sellerIds",
  "sellerId",
  "dateFrom",
  "dateTo",
  "date",
  "resourceType"
] as const;

export const DIAGNOSTIC_REDACTION_RULES = [
  "Stellar account and secret keys are replaced with [redacted-stellar-key].",
  "64+ character hexadecimal transaction and evidence hashes are replaced with [redacted-hash].",
  "Bearer tokens, JWT-shaped values, and authorization header values are replaced with [redacted-token].",
  "Email addresses are replaced with [redacted-email].",
  "Attempt, seller, resource, receipt, settlement, and correlation identifiers are masked to their first and last four characters.",
  "Headers outside the documented safe allowlist are omitted entirely."
] as const;

export type DiagnosticBundleInput = {
  appVersion: string;
  environment: string;
  filters?: PaymentActivityFilters;
  headers?: Record<string, string>;
  network: string;
  source?: "demo" | "live";
  telemetryEvents?: readonly TelemetryEvent[];
  transaction?: PaymentActivity | null;
};

export type DiagnosticBundle = {
  app: {
    environment: string;
    version: string;
  };
  context: {
    activeFilters: Record<string, unknown>;
    network: string;
    source: "demo" | "live";
  };
  generatedAt: string;
  headers: Record<string, string>;
  redactionRules: readonly string[];
  schemaVersion: "1.0";
  transaction: Record<string, unknown> | null;
  telemetryEvents: Array<Record<string, unknown>>;
};

const stellarKeyPattern = /\b[GS][A-Z2-7]{55}\b/g;
const hexHashPattern = /\b[a-f0-9]{64,128}\b/gi;
const bearerPattern = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const jwtPattern = /\b[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

const sensitiveHeaderNames = [
  "authorization",
  "cookie",
  "proxy-authorization",
  "set-cookie",
  "x-payment-signature"
];

/**
 * Applies the documented text redaction rules to a single value.
 */
export function redactDiagnosticText(value: string): string {
  return value
    .replace(stellarKeyPattern, "[redacted-stellar-key]")
    .replace(hexHashPattern, "[redacted-hash]")
    .replace(bearerPattern, "Bearer [redacted-token]")
    .replace(jwtPattern, "[redacted-token]")
    .replace(emailPattern, "[redacted-email]");
}

/**
 * Masks identifiers while keeping a short prefix and suffix for support
 * correlation. Values shorter than 12 characters are fully redacted.
 */
export function maskDiagnosticIdentifier(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value.length === 0) {
    return null;
  }

  const redacted = redactDiagnosticText(value);

  if (redacted !== value) {
    return redacted;
  }

  if (value.length < 12) {
    return "[redacted-identifier]";
  }

  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export function createDiagnosticBundle(input: DiagnosticBundleInput): DiagnosticBundle {
  return {
    app: {
      environment: limitText(input.environment, 40),
      version: limitText(input.appVersion, 40)
    },
    context: {
      activeFilters: sanitizeFilters(input.filters),
      network: limitText(input.network, 60),
      source: input.source ?? "demo"
    },
    generatedAt: new Date().toISOString(),
    headers: sanitizeHeaders(input.headers),
    redactionRules: DIAGNOSTIC_REDACTION_RULES,
    schemaVersion: "1.0",
    transaction: input.transaction ? sanitizeTransaction(input.transaction) : null,
    telemetryEvents: (input.telemetryEvents ?? []).map(sanitizeTelemetryEvent)
  };
}

export function serializeDiagnosticBundle(bundle: DiagnosticBundle): string {
  return JSON.stringify(bundle, null, 2);
}

function sanitizeTransaction(activity: PaymentActivity): Record<string, unknown> {
  const transactionHash =
    activity.settlement?.transactionHash ?? activity.receipt?.transactionHash ?? null;

  return {
    amount: limitText(activity.attempt.amount, 32),
    assetCode: limitText(activity.attempt.assetCode, 12),
    attemptId: maskDiagnosticIdentifier(activity.attempt.id),
    correlationId: maskDiagnosticIdentifier(activity.receipt?.correlationId),
    createdAt: limitText(activity.attempt.createdAt, 40),
    failureCode: activity.attempt.failureCode ? limitText(activity.attempt.failureCode, 80) : null,
    failureReason: activity.attempt.failureReason
      ? limitText(redactDiagnosticText(activity.attempt.failureReason), 240)
      : null,
    ledger: activity.settlement?.ledger ?? activity.receipt?.ledger ?? null,
    network: limitText(activity.attempt.network, 60),
    receiptId: maskDiagnosticIdentifier(activity.receipt?.id),
    receiptStatus: activity.receipt?.status ? limitText(activity.receipt.status, 40) : null,
    resourceId: maskDiagnosticIdentifier(activity.attempt.resourceId),
    sellerId: maskDiagnosticIdentifier(activity.attempt.sellerId),
    settlementId: maskDiagnosticIdentifier(activity.settlement?.id),
    status: limitText(activity.settlement?.status ?? activity.attempt.status, 40),
    transactionHash: transactionHash === null ? null : "[redacted-hash]"
  };
}

function sanitizeFilters(filters: PaymentActivityFilters | undefined): Record<string, unknown> {
  if (filters === undefined) {
    return {};
  }

  const sanitized: Record<string, unknown> = {};

  for (const key of DIAGNOSTIC_FILTER_FIELDS) {
    const value = filters[key];

    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      sanitized[key] = value.map((item) => limitText(redactDiagnosticText(String(item)), 120));
    } else if (typeof value === "string") {
      sanitized[key] = limitText(redactDiagnosticText(value), 120);
    }
  }

  return sanitized;
}

function sanitizeHeaders(headers: Record<string, string> | undefined): Record<string, string> {
  if (headers === undefined) {
    return {};
  }

  const sanitized: Record<string, string> = {};

  for (const [name, value] of Object.entries(headers)) {
    const normalized = name.toLowerCase();

    if (sensitiveHeaderNames.includes(normalized)) {
      continue;
    }

    if (!(DIAGNOSTIC_HEADER_ALLOWLIST as readonly string[]).includes(normalized)) {
      continue;
    }

    sanitized[normalized] = limitText(redactDiagnosticText(value), 200);
  }

  return sanitized;
}

function sanitizeTelemetryEvent(event: TelemetryEvent): Record<string, unknown> {
  const allowedFields = EVENT_ALLOWLIST[event.eventType] ?? [];
  const data = event.data as unknown as Record<string, unknown>;
  const sanitizedData: Record<string, unknown> = {};

  for (const field of allowedFields) {
    const value = data[field];

    if (value === undefined) {
      continue;
    }

    sanitizedData[field] =
      typeof value === "string" ? limitText(redactDiagnosticText(value), 120) : value;
  }

  return {
    data: sanitizedData,
    eventType: event.eventType,
    networkId: event.context.networkId,
    timestamp: new Date(event.timestamp).toISOString()
  };
}

function limitText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}
