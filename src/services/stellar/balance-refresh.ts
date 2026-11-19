import type { Receipt } from "@/services/api/schemas";
import { confirmedReceiptLedger } from "@/services/payments";
import { pollWithBackoff, type BoundedPollOptions, type PollVisibility } from "@/services/polling";
import { queryAccountInfo, queryLatestLedger, type StellarBalance } from "./horizon";
import type { NetworkId } from "@/config/networks";

export type BalanceRefreshStatus =
  | "refreshed"
  | "not_applicable"
  | "timeout"
  | "failed"
  | "cancelled";

export type BalanceRefreshResult = {
  attempts: number;
  balances: StellarBalance[];
  confirmedLedger?: number;
  error?: string;
  observedLedger?: number;
  status: BalanceRefreshStatus;
};

export type BalanceRefreshDependencies = {
  fetchImpl?: typeof fetch;
  initialDelayMs?: number;
  maxAttempts?: number;
  maxDelayMs?: number;
  maxElapsedMs?: number;
  now?: () => number;
  signal?: AbortSignal;
  sleep?: BoundedPollOptions<RefreshCheck>["sleep"];
  visibility?: PollVisibility;
};

type RefreshCheck = {
  balances?: StellarBalance[];
  error?: string;
  observedLedger?: number;
  ready: boolean;
};

export const DEFAULT_BALANCE_REFRESH_BUDGET = {
  initialDelayMs: 750,
  maxAttempts: 5,
  maxDelayMs: 8_000,
  maxElapsedMs: 20_000
} as const;

/**
 * Stable cache key for a balance refresh, derived strictly from confirmed
 * ledger evidence. Pending or failed receipts have no refresh key.
 */
export function balanceRefreshKey(
  receipt: Pick<Receipt, "id" | "ledger" | "network" | "status" | "transactionHash">
): string | undefined {
  const confirmedLedger = confirmedReceiptLedger(receipt);

  if (confirmedLedger === undefined) {
    return undefined;
  }

  const evidence = receipt.transactionHash ?? receipt.id;

  return `balances:${receipt.network}:${evidence}:${confirmedLedger}`;
}

/**
 * Refreshes balances and trustlines only after Horizon reports that the ledger
 * confirming the payment is closed.
 *
 * Horizon reads are bounded by `DEFAULT_BALANCE_REFRESH_BUDGET`. Polling stops
 * on the confirmed ledger, on cancellation (timeout/unmount), and when the
 * request budget is exhausted. Horizon lag is surfaced as a timeout instead of
 * a failure, while repeated Horizon errors surface as a failed refresh.
 */
export async function refreshBalancesAfterPayment({
  account,
  deps = {},
  network,
  receipt
}: {
  account: string;
  deps?: BalanceRefreshDependencies;
  network?: NetworkId;
  receipt: Pick<Receipt, "id" | "ledger" | "network" | "status" | "transactionHash">;
}): Promise<BalanceRefreshResult> {
  const confirmedLedger = confirmedReceiptLedger(receipt);

  if (receipt.status === "failed") {
    return {
      attempts: 0,
      balances: [],
      error: "Balances are not refreshed for a failed payment.",
      status: "not_applicable"
    };
  }

  if (confirmedLedger === undefined) {
    return {
      attempts: 0,
      balances: [],
      error: "The receipt has no confirmed ledger evidence yet.",
      status: "not_applicable"
    };
  }

  if (account === "") {
    return {
      attempts: 0,
      balances: [],
      confirmedLedger,
      error: "A public account is required to refresh balances.",
      status: "not_applicable"
    };
  }

  const targetNetwork = network ?? receipt.network;
  const fetchImpl = deps.fetchImpl ?? fetch;
  let lastObservedLedger: number | undefined;
  let lastError: string | undefined;

  const outcome = await pollWithBackoff<RefreshCheck>({
    check: async () => {
      try {
        const latest = await queryLatestLedger(targetNetwork, fetchImpl);
        lastObservedLedger = latest.sequence;

        // Horizon lag: the confirming ledger is not closed yet, so reading the
        // account now would return stale balances.
        if (latest.sequence < confirmedLedger) {
          return { observedLedger: latest.sequence, ready: false };
        }

        const accountInfo = await queryAccountInfo(account, targetNetwork, fetchImpl);
        lastError = undefined;

        return {
          balances: accountInfo.balances,
          observedLedger: latest.sequence,
          ready: true
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        return { error: lastError, observedLedger: lastObservedLedger, ready: false };
      }
    },
    initialDelayMs: deps.initialDelayMs ?? DEFAULT_BALANCE_REFRESH_BUDGET.initialDelayMs,
    isTerminal: (value) => value.ready,
    maxAttempts: deps.maxAttempts ?? DEFAULT_BALANCE_REFRESH_BUDGET.maxAttempts,
    maxDelayMs: deps.maxDelayMs ?? DEFAULT_BALANCE_REFRESH_BUDGET.maxDelayMs,
    maxElapsedMs: deps.maxElapsedMs ?? DEFAULT_BALANCE_REFRESH_BUDGET.maxElapsedMs,
    now: deps.now,
    signal: deps.signal,
    sleep: deps.sleep,
    visibility: deps.visibility
  });

  if (outcome.status === "cancelled") {
    return {
      attempts: outcome.attempts,
      balances: [],
      confirmedLedger,
      observedLedger: lastObservedLedger,
      status: "cancelled"
    };
  }

  if (outcome.status === "terminal") {
    return {
      attempts: outcome.attempts,
      balances: outcome.value.balances ?? [],
      confirmedLedger,
      observedLedger: outcome.value.observedLedger,
      status: "refreshed"
    };
  }

  if (lastError !== undefined) {
    return {
      attempts: outcome.attempts,
      balances: [],
      confirmedLedger,
      error: lastError,
      observedLedger: lastObservedLedger,
      status: "failed"
    };
  }

  return {
    attempts: outcome.attempts,
    balances: [],
    confirmedLedger,
    error: `Horizon has not closed ledger ${confirmedLedger} yet (latest observed: ${lastObservedLedger ?? "unknown"}).`,
    observedLedger: lastObservedLedger,
    status: "timeout"
  };
}
