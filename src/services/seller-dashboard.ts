import { demoReceipts, demoResources, demoSellers, findDemoSeller } from "@/fixtures/lumenbazaar";
import { sumDecimalAmounts } from "@/lib/amount-formatter";
import type { NetworkId } from "@/config/networks";
import type { Receipt, Resource, Seller } from "@/services/api/schemas";
import type { RuntimeEnvironment } from "@/config/runtime";
import { paymentActivityStatus, type PaymentActivity } from "@/services/payments";
import { currentRuntimeMode, requireDemoMode } from "@/services/runtime-mode";

export type SellerDashboardSnapshot = {
  identityStatus: "connected" | "missing";
  recentPayments: Receipt[];
  resourceCount: number;
  resources: Resource[];
  seller: Seller;
  verificationStatus: "verified" | "unverified";
};

export function loadSellerDashboard(
  sellerId: string = demoSellers[0]?.id ?? "seller_atlas_weather",
  mode: RuntimeEnvironment = currentRuntimeMode()
): SellerDashboardSnapshot {
  requireDemoMode(mode);
  const seller = findDemoSeller(sellerId) ?? demoSellers[0];

  if (seller === undefined) {
    throw new Error("SELLER_NOT_FOUND");
  }

  const resources = demoResources.filter((resource) => resource.sellerId === seller.id);
  const recentPayments = demoReceipts.filter((receipt) => receipt.sellerId === seller.id);

  return {
    identityStatus: seller.walletAddress.length > 0 ? "connected" : "missing",
    recentPayments,
    resourceCount: resources.length,
    resources,
    seller,
    verificationStatus: seller.domainVerifiedAt === null ? "unverified" : "verified"
  };
}

/**
 * Canonical identity of an asset. Symbol alone is never enough: the same code
 * can be issued by different issuers, or live on a different network.
 */
export type SellerEarningsAsset = {
  assetCode: string;
  assetIssuer: string;
  network: NetworkId;
};

export type SellerEarningsGroup = SellerEarningsAsset & {
  /** Sum of settled amounts, or null when any settled amount is unparseable. */
  settledTotal: string | null;
  settledCount: number;
  pendingCount: number;
  failedCount: number;
  /** True when at least one amount in this group could not be aggregated. */
  amountUnavailable: boolean;
};

export type SellerEarningsSummary = {
  /** Oldest included attempt timestamp, or null when there is no activity. */
  from: string | null;
  /** Newest included attempt timestamp, or null when there is no activity. */
  to: string | null;
  groups: SellerEarningsGroup[];
  /** True when no group could be fully aggregated. */
  unavailable: boolean;
};

/**
 * Aggregates settlement totals by canonical asset and reports the time window
 * the totals cover. Amounts are summed as decimal strings with BigInt
 * arithmetic, so zero values and very large values stay exact.
 *
 * Pending and failed attempts are counted but never added to the settled
 * total, and an unparseable amount marks the affected group as unavailable
 * instead of being silently dropped.
 */
export function summarizeSellerEarnings(
  activity: readonly PaymentActivity[]
): SellerEarningsSummary {
  const groups = new Map<string, SellerEarningsGroup & { amounts: string[]; invalid: boolean }>();
  let from: string | null = null;
  let to: string | null = null;

  for (const item of activity) {
    const attempt = item.attempt;
    const key = `${attempt.network}|${attempt.assetCode}|${attempt.assetIssuer}`;
    const group =
      groups.get(key) ??
      ({
        amountUnavailable: false,
        amounts: [],
        assetCode: attempt.assetCode,
        assetIssuer: attempt.assetIssuer,
        failedCount: 0,
        invalid: false,
        network: attempt.network,
        pendingCount: 0,
        settledCount: 0,
        settledTotal: "0"
      } satisfies SellerEarningsGroup & { amounts: string[]; invalid: boolean });

    const status = paymentActivityStatus(item);

    if (status === "settled") {
      group.settledCount += 1;
      group.amounts.push(attempt.amount);
      try {
        sumDecimalAmounts([attempt.amount]);
      } catch {
        group.invalid = true;
      }
    } else if (status === "failed") {
      group.failedCount += 1;
    } else {
      group.pendingCount += 1;
    }

    if (from === null || attempt.createdAt < from) {
      from = attempt.createdAt;
    }
    if (to === null || attempt.createdAt > to) {
      to = attempt.createdAt;
    }

    groups.set(key, group);
  }

  const summaries = [...groups.values()].map(({ amounts, invalid, ...group }) => ({
    ...group,
    amountUnavailable: invalid,
    settledTotal: invalid ? null : sumDecimalAmounts(amounts)
  }));

  return {
    from,
    groups: summaries.sort((left, right) =>
      `${left.network}|${left.assetCode}|${left.assetIssuer}`.localeCompare(
        `${right.network}|${right.assetCode}|${right.assetIssuer}`
      )
    ),
    to,
    unavailable: summaries.length > 0 && summaries.every((group) => group.amountUnavailable)
  };
}
