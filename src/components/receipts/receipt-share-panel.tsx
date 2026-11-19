"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { Receipt } from "@/services/api/schemas";
import { buildReceiptSharePlan, isMinimumReceiptShareLink } from "@/services/receipt-share";

type ShareNotice = {
  tone: "success" | "warning";
  message: string;
};

/**
 * Two-step receipt sharing: users review exactly which fields a link contains
 * before anything is copied or handed to the native share sheet.
 */
export function ReceiptSharePanel({ receipt }: { receipt: Receipt }) {
  const [reviewing, setReviewing] = useState(false);
  const [notice, setNotice] = useState<ShareNotice | undefined>(undefined);
  const plan = buildReceiptSharePlan(
    receipt,
    typeof window === "undefined" ? undefined : window.location.origin
  );
  const shareUrl = plan.url;

  function startReview() {
    setNotice(undefined);
    setReviewing(true);
  }

  async function copyLink() {
    try {
      if (typeof navigator === "undefined" || navigator.clipboard === undefined) {
        throw new Error("Clipboard unavailable");
      }

      await navigator.clipboard.writeText(shareUrl);
      setNotice({
        message: "Share link copied. It contains only the receipt reference.",
        tone: "success"
      });
    } catch {
      // Recoverable: the link stays visible and selectable so the user can copy
      // it manually instead of losing the share flow.
      setNotice({
        message: "Copy failed. Select the link above and copy it manually.",
        tone: "warning"
      });
    }
  }

  async function nativeShare() {
    try {
      if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
        throw new Error("Native share unavailable");
      }

      await navigator.share({
        text: `Receipt ${plan.publicReference}`,
        title: "LumenBazaar receipt",
        url: shareUrl
      });
      setNotice({ message: "Receipt link shared.", tone: "success" });
    } catch {
      // A refused or unsupported share never dead-ends: the link and the copy
      // action remain available below.
      setNotice({
        message: "Native share is unavailable. Copy the link above instead.",
        tone: "warning"
      });
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Share receipt</h2>
          <p className="mt-1 text-sm text-slate-600">
            Review exactly what leaves this device before sharing.
          </p>
        </div>
        {reviewing ? (
          <Badge tone="info">Privacy review</Badge>
        ) : (
          <Button onClick={startReview} type="button" variant="secondary">
            <Share2 aria-hidden="true" className="h-4 w-4" />
            Review share link
          </Button>
        )}
      </CardHeader>

      {reviewing ? (
        <CardBody className="space-y-4 text-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <section aria-labelledby="share-included-heading">
              <h3 className="font-medium text-slate-900" id="share-included-heading">
                Included in the link
              </h3>
              <ul className="mt-2 space-y-1">
                {plan.linkFields.map((field) => (
                  <li className="flex flex-wrap gap-2" key={field.label}>
                    <span className="text-slate-500">{field.label}:</span>
                    <span className="break-all font-medium text-slate-900">{field.value}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="share-visible-heading">
              <h3 className="font-medium text-slate-900" id="share-visible-heading">
                Visible to the recipient
              </h3>
              <ul className="mt-2 space-y-1">
                {plan.recipientVisibleFields.map((field) => (
                  <li className="flex flex-wrap gap-2" key={field.label}>
                    <span className="text-slate-500">{field.label}:</span>
                    <span className="break-all font-medium text-slate-900">{field.value}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section aria-labelledby="share-excluded-heading">
            <h3 className="font-medium text-slate-900" id="share-excluded-heading">
              Excluded from the link
            </h3>
            <ul className="mt-2 grid gap-1 text-slate-600 sm:grid-cols-2">
              {plan.excludedFields.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
          </section>

          <label className="block space-y-1">
            <span className="font-medium text-slate-700">Public receipt link</span>
            <input
              aria-describedby="share-link-help"
              className="min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-slate-950"
              onFocus={(event) => event.currentTarget.select()}
              readOnly
              value={shareUrl}
            />
          </label>
          <p className="text-xs text-slate-500" id="share-link-help">
            {isMinimumReceiptShareLink(shareUrl)
              ? "No private query or filter state is included."
              : "This link contains unexpected state and should not be shared."}
          </p>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void copyLink()} type="button">
              <Copy aria-hidden="true" className="h-4 w-4" />
              Copy link
            </Button>
            <Button onClick={() => void nativeShare()} type="button" variant="secondary">
              <Share2 aria-hidden="true" className="h-4 w-4" />
              Share…
            </Button>
            <Button onClick={() => setReviewing(false)} type="button" variant="ghost">
              <Check aria-hidden="true" className="h-4 w-4" />
              Done
            </Button>
          </div>

          {notice ? (
            <p
              aria-live="polite"
              className={`rounded border px-3 py-2 text-sm ${
                notice.tone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
              role="status"
            >
              {notice.message}
            </p>
          ) : null}
        </CardBody>
      ) : null}
    </Card>
  );
}
