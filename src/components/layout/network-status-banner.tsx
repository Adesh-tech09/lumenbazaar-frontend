"use client";

import { RefreshCw, TriangleAlert, WifiOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { NetworkProbeCheck, NetworkStatusLevel } from "@/services/operators";
import { nextNetworkAnnouncement } from "@/services/operators";

import { useNetworkStatus } from "./network-status-provider";

const toneClasses = {
  danger: "border-red-300 bg-red-50 text-red-900",
  warning: "border-amber-300 bg-amber-50 text-amber-900"
} as const;

const statusLabels: Record<NetworkProbeCheck["status"], string> = {
  degraded: "Degraded",
  operational: "Operational",
  unavailable: "Unavailable",
  unknown: "Unknown"
};

export function NetworkStatusBanner() {
  const { assessment, isOnline, recheck } = useNetworkStatus();
  const [announcement, setAnnouncement] = useState("");
  const announcedKey = useRef<string | null>(null);

  useEffect(() => {
    const next = nextNetworkAnnouncement(announcedKey.current, assessment);
    if (next === null) return;

    announcedKey.current = next.key;
    setAnnouncement(next.message);
  }, [assessment]);

  const visible = assessment.level !== "operational" && assessment.level !== "checking";
  const tone: keyof typeof toneClasses = assessment.level === "offline" ? "danger" : "warning";

  return (
    <>
      <div
        aria-atomic="true"
        aria-live={assessment.level === "offline" ? "assertive" : "polite"}
        className="sr-only"
        role="status"
      >
        {announcement}
      </div>

      {visible ? (
        <div className={`border-b ${toneClasses[tone]}`}>
          <section
            aria-labelledby="network-status-title"
            className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-6 lg:px-8"
          >
            <div className="flex min-w-0 items-start gap-3">
              {assessment.level === "offline" ? (
                <WifiOff aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold" id="network-status-title">
                    {bannerTitle(assessment.level)}
                  </p>
                  <Badge tone={tone === "danger" ? "danger" : "warning"}>
                    {bannerBadge(assessment.level)}
                  </Badge>
                </div>

                <p className="text-xs leading-5">{bannerDescription(assessment.level)}</p>

                <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
                  <StatusSource
                    label="Browser network"
                    observedAt={assessment.browser.observedAt}
                    status={assessment.browser.status === "online" ? "Online" : "Offline"}
                  />
                  <StatusSource
                    label="Backend API"
                    observedAt={assessment.backend.checkedAt}
                    status={
                      isOnline ? statusLabels[assessment.backend.status] : "Paused while offline"
                    }
                  />
                  <StatusSource
                    label="Stellar"
                    observedAt={assessment.stellar.checkedAt}
                    status={
                      isOnline ? statusLabels[assessment.stellar.status] : "Paused while offline"
                    }
                  />
                </dl>

                <p className="text-xs leading-5">
                  {isOnline
                    ? "Status checks are read-only. Failed payment attempts are never retried automatically."
                    : "Status checks resume when the browser reconnects. Payment attempts are not retried automatically."}
                </p>
              </div>
            </div>

            {isOnline ? (
              <Button className="shrink-0" onClick={recheck} type="button" variant="secondary">
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                Re-check status
              </Button>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}

function StatusSource({
  label,
  observedAt,
  status
}: {
  label: string;
  observedAt: string | null;
  status: string;
}) {
  return (
    <div className="flex flex-wrap gap-x-1">
      <dt className="font-medium">{label}:</dt>
      <dd>
        {status}
        {" · "}
        {observedAt === null ? (
          "not yet checked"
        ) : (
          <>
            {"checked "}
            <time dateTime={observedAt}>{formatTimestamp(observedAt)}</time>
          </>
        )}
      </dd>
    </div>
  );
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "unknown time";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "medium"
  }).format(date);
}

function bannerTitle(level: NetworkStatusLevel) {
  if (level === "offline") return "You are offline";
  if (level === "unverifiable") return "Connectivity is unverified";
  return "Service checks are degraded";
}

function bannerBadge(level: NetworkStatusLevel) {
  if (level === "offline") return "Offline";
  if (level === "unverifiable") return "Unverified";
  return "Degraded";
}

function bannerDescription(level: NetworkStatusLevel) {
  if (level === "offline") {
    return "The browser has no network connection. Payment and settlement actions fail closed until it reconnects.";
  }

  if (level === "unverifiable") {
    return "LumenBazaar cannot confirm backend or Stellar readiness. Payment capabilities stay unavailable until checks succeed.";
  }

  return "The browser is online, but backend or Stellar checks are not fully operational. Affected capabilities fail closed until checks recover.";
}
