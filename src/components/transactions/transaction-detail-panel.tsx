"use client";

import { ExternalLink, ReceiptText, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  explorerTransactionUrl,
  formatPaymentAmount,
  isValidTransactionHash,
  paymentActivityStatus,
  shortHash,
  type PaymentActivity
} from "@/services/payments";
import {
  resolveTransactionDetail,
  transactionIdFromParams,
  withoutTransactionSelection
} from "@/services/transaction-detail";

export function TransactionDetailPanel({ activities }: { activities: PaymentActivity[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const transactionId = transactionIdFromParams(new URLSearchParams(searchParams.toString()));
  const result = resolveTransactionDetail(transactionId, activities);

  const close = useCallback(() => {
    const params = withoutTransactionSelection(new URLSearchParams(window.location.search));
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });

    requestAnimationFrame(() => {
      const trigger = document.querySelector<HTMLElement>(
        `[data-transaction-id="${cssEscape(transactionId ?? "")}"]`
      );
      trigger?.focus();
    });
  }, [pathname, router, transactionId]);

  useEffect(() => {
    if (transactionId === undefined) {
      return;
    }

    document.querySelector<HTMLButtonElement>("[data-transaction-detail-close]")?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close, transactionId]);

  if (transactionId === undefined) {
    return null;
  }

  return (
    <div
      aria-labelledby="transaction-detail-title"
      aria-modal="true"
      className="fixed inset-0 z-40 flex justify-end bg-slate-950/30"
      onClick={close}
      role="dialog"
    >
      <section
        className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950" id="transaction-detail-title">
              Transaction detail
            </h2>
            <p className="mt-1 break-all text-xs text-slate-500">{transactionId}</p>
          </div>
          <Button
            aria-label="Close transaction details"
            data-transaction-detail-close
            onClick={close}
            type="button"
            variant="secondary"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-5 px-5 py-5">
          {result.state === "missing" ? (
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-slate-950">Transaction not found</h3>
              <p className="text-sm leading-6 text-slate-600">
                No record matches this link. The transaction may have been removed, or the link may
                point at a different environment.
              </p>
            </div>
          ) : null}

          {result.state === "unauthorized" ? (
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-slate-950">Transaction not authorized</h3>
              <p className="text-sm leading-6 text-slate-600">
                This record references a seller outside the reviewed workspace. Its details are
                hidden rather than shown as missing.
              </p>
            </div>
          ) : null}

          {result.state === "found" ? <FoundDetail activity={result.activity} /> : null}
        </div>
      </section>
    </div>
  );
}

function FoundDetail({ activity }: { activity: PaymentActivity }) {
  const status = paymentActivityStatus(activity);
  const transactionHash = activity.settlement?.transactionHash ?? activity.receipt?.transactionHash;
  const explorerUrl = isValidTransactionHash(transactionHash)
    ? explorerTransactionUrl(activity.attempt.network, transactionHash)
    : null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={status === "failed" ? "danger" : status === "settled" ? "success" : "warning"}>
          {status}
        </Badge>
        <Badge tone="neutral">{activity.attempt.network}</Badge>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <DetailItem label="Attempt" value={activity.attempt.id} />
        <DetailItem
          label="Seller"
          value={activity.seller?.displayName ?? activity.attempt.sellerId}
        />
        <DetailItem
          label="Resource"
          value={activity.resource?.name ?? activity.attempt.resourceId}
        />
        <DetailItem
          label="Amount"
          value={formatPaymentAmount(activity.attempt.amount, activity.attempt.assetCode)}
        />
        <DetailItem
          label="Created"
          value={new Intl.DateTimeFormat("en", {
            dateStyle: "medium",
            timeStyle: "short"
          }).format(new Date(activity.attempt.createdAt))}
        />
        <DetailItem
          label="Ledger"
          value={activity.settlement?.ledger?.toString() ?? "Unavailable"}
        />
      </dl>

      <div>
        <h3 className="text-sm font-semibold text-slate-900">Failure</h3>
        {activity.attempt.failureCode ? (
          <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-3">
            <Badge tone="danger">{activity.attempt.failureCode}</Badge>
            <p className="mt-2 text-sm leading-6 text-red-900">{activity.attempt.failureReason}</p>
          </div>
        ) : (
          <p className="mt-1 text-sm text-slate-600">No failure recorded.</p>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-900">Evidence</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {activity.receipt ? (
            <Link
              className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700 hover:bg-slate-50"
              href={`/transactions?receipt=${activity.receipt.id}`}
            >
              <ReceiptText aria-hidden="true" className="h-4 w-4" />
              {activity.receipt.id}
            </Link>
          ) : null}
          {explorerUrl && transactionHash ? (
            <a
              className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700 hover:bg-slate-50"
              href={explorerUrl}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
              {shortHash(transactionHash)}
            </a>
          ) : (
            <span className="text-sm text-slate-600">
              {transactionHash ? "Synthetic transaction identifier" : "Settlement pending"}
            </span>
          )}
        </div>
      </div>
    </>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <dt className="text-xs font-medium uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 break-all text-sm text-slate-900">{value}</dd>
    </div>
  );
}

function cssEscape(value: string) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }

  return value.replace(/["\\]/g, "");
}
