"use client";

import { Download, ShieldCheck, X } from "lucide-react";
import { useState } from "react";

import packageJson from "../../../package.json";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { isDemoMode, loadRuntimeConfig } from "@/config/runtime";
import { downloadFile } from "@/lib/export-utils";
import {
  createDiagnosticBundle,
  DIAGNOSTIC_REDACTION_RULES,
  serializeDiagnosticBundle,
  type DiagnosticBundle
} from "@/services/diagnostics";
import type { PaymentActivity, PaymentActivityFilters } from "@/services/payments";

export function DiagnosticBundlePanel({
  filters,
  transaction
}: {
  filters: PaymentActivityFilters;
  transaction?: PaymentActivity;
}) {
  const mode = loadRuntimeConfig().environment;
  const [bundle, setBundle] = useState<DiagnosticBundle>();

  const handleReview = () => {
    setBundle(
      createDiagnosticBundle({
        appVersion: packageJson.version,
        environment: mode,
        filters,
        network: transaction?.attempt.network ?? filters.network ?? "unavailable",
        source: isDemoMode(mode) ? "demo" : "live",
        transaction
      })
    );
  };

  const handleDownload = () => {
    if (bundle === undefined) {
      return;
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
    downloadFile(
      serializeDiagnosticBundle(bundle),
      `payment-diagnostics-${timestamp}.json`,
      "application/json"
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
            <ShieldCheck aria-hidden="true" className="h-5 w-5 text-teal-700" />
            Payment diagnostics
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Build a support bundle from an explicit allowlist, review it, then download.
          </p>
        </div>
        {bundle === undefined ? (
          <Button onClick={handleReview} type="button" variant="secondary">
            Review diagnostics
          </Button>
        ) : null}
      </CardHeader>
      <CardBody className="space-y-3">
        {bundle === undefined ? (
          <ul className="list-disc space-y-1 pl-5 text-xs leading-5 text-slate-600">
            {DIAGNOSTIC_REDACTION_RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        ) : (
          <>
            <p className="text-sm font-medium text-slate-800">
              Review the bundle before downloading. Raw headers, keys, signatures, and transaction
              hashes are not included.
            </p>
            <pre className="max-h-80 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-800">
              {serializeDiagnosticBundle(bundle)}
            </pre>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleDownload} type="button" variant="primary">
                <Download aria-hidden="true" className="h-4 w-4" />
                Download redacted bundle
              </Button>
              <Button onClick={() => setBundle(undefined)} type="button" variant="secondary">
                <X aria-hidden="true" className="h-4 w-4" />
                Close review
              </Button>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
