import type { PaymentActivity } from "@/services/payments";

/**
 * Deep-linkable transaction detail state.
 * `missing` and `unauthorized` are explicit outcomes so the panel never renders
 * an empty record as if it were valid.
 */
export type TransactionDetailResult =
  | { activity: PaymentActivity; state: "found" }
  | { state: "missing" }
  | { state: "unauthorized" };

export function transactionIdFromParams(params: URLSearchParams): string | undefined {
  const id = params.get("transaction")?.trim();
  return id ? id : undefined;
}

export function withTransactionSelection(
  current: URLSearchParams,
  transactionId: string
): URLSearchParams {
  const next = new URLSearchParams(current);
  next.set("transaction", transactionId);
  return next;
}

export function withoutTransactionSelection(current: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(current);
  next.delete("transaction");
  return next;
}

/**
 * Resolves a transaction against the visible activity set.
 *
 * A record is only authorized for detail review when its seller is part of the
 * reviewed workspace. Records that reference an unknown seller are labeled
 * unauthorized rather than silently treated as missing.
 */
export function resolveTransactionDetail(
  transactionId: string | null | undefined,
  activities: readonly PaymentActivity[]
): TransactionDetailResult {
  const normalized = transactionId?.trim();

  if (!normalized) {
    return { state: "missing" };
  }

  const activity = activities.find((item) => item.attempt.id === normalized);

  if (activity === undefined) {
    return { state: "missing" };
  }

  if (activity.seller === undefined) {
    return { state: "unauthorized" };
  }

  return { activity, state: "found" };
}
