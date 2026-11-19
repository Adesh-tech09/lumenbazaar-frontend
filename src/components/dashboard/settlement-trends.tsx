"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart3, TrendingDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { queryKeys } from "@/services/api/query";
import {
  loadSettlementTrends,
  type SettlementTrendPoint,
  type SettlementTrends as SettlementTrendsData
} from "@/services/dashboard";

const utcDateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  timeZone: "UTC"
});

export function SettlementTrends() {
  const { data, isError, refetch } = useQuery({
    queryFn: () => loadSettlementTrends(),
    queryKey: queryKeys.settlementTrends
  });

  if (data === undefined) {
    if (!isError) {
      return (
        <div className="grid gap-4 lg:grid-cols-2" aria-busy="true">
          <Card className="h-72 animate-pulse bg-white" />
          <Card className="h-72 animate-pulse bg-white" />
        </div>
      );
    }

    return <UnavailableTrends onRetry={() => void refetch()} />;
  }

  if (data.source === "unavailable") {
    return <UnavailableTrends onRetry={() => void refetch()} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={data.source === "demo" ? "warning" : "success"}>
          {data.source === "demo" ? "Explicit demo aggregates" : "Server aggregates"}
        </Badge>
        <Badge tone="neutral">{data.windowLabel}</Badge>
        {data.partial ? <Badge tone="warning">Some windows unavailable</Badge> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <LatencyChart data={data} />
        <FailureChart data={data} />
      </div>
    </div>
  );
}

function UnavailableTrends({ onRetry }: { onRetry: () => void }) {
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-950">Settlement trends</h2>
        <Badge tone="danger">Unavailable</Badge>
      </CardHeader>
      <CardBody className="space-y-2">
        <p className="text-sm leading-6 text-slate-700">
          Server aggregates for settlement latency and failure trends are unavailable.
        </p>
        <p className="text-sm leading-6 text-slate-600">
          Unavailable windows are not zero incidents. No chart is drawn until typed aggregate data
          is returned.
        </p>
        <button
          className="text-sm font-medium text-teal-700 hover:text-teal-900"
          onClick={onRetry}
          type="button"
        >
          Retry
        </button>
      </CardBody>
    </Card>
  );
}

function LatencyChart({ data }: { data: SettlementTrendsData }) {
  const values = data.points
    .map((point) => point.p95LatencyMs)
    .filter((value): value is number => value !== null);
  const max = Math.max(1, ...values);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Settlement latency</h2>
          <p className="mt-1 text-xs text-slate-600">p95 per window, {data.windowLabel}</p>
        </div>
        <BarChart3 aria-hidden="true" className="h-5 w-5 text-teal-700" />
      </CardHeader>
      <CardBody className="space-y-4">
        <figure aria-labelledby="settlement-latency-figure">
          <figcaption className="sr-only" id="settlement-latency-figure">
            Settlement p95 latency by window with an accessible data table below.
          </figcaption>
          <div className="space-y-2">
            {data.points.map((point) => {
              const value = point.p95LatencyMs;

              return (
                <div className="flex items-center gap-2" key={point.windowStart}>
                  <span className="w-16 shrink-0 text-xs text-slate-600">
                    {formatWindow(point)}
                  </span>
                  <div className="h-3 flex-1 rounded-sm bg-slate-100">
                    {value === null ? (
                      <span className="block px-1 text-[10px] leading-3 text-slate-500">
                        Unavailable
                      </span>
                    ) : (
                      <div
                        className="h-full rounded-sm bg-teal-700"
                        style={{ width: `${Math.max(4, (value / max) * 100)}%` }}
                      />
                    )}
                  </div>
                  <span className="w-20 shrink-0 text-right text-xs text-slate-700">
                    {value === null ? "Unavailable" : `${value} ms`}
                  </span>
                </div>
              );
            })}
          </div>
          <LatencyTable points={data.points} />
        </figure>
      </CardBody>
    </Card>
  );
}

function FailureChart({ data }: { data: SettlementTrendsData }) {
  const values = data.points
    .map((point) => point.failedCount)
    .filter((value): value is number => value !== null);
  const max = Math.max(1, ...values);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Failure trend</h2>
          <p className="mt-1 text-xs text-slate-600">Failed settlements per window</p>
        </div>
        <TrendingDown aria-hidden="true" className="h-5 w-5 text-red-700" />
      </CardHeader>
      <CardBody className="space-y-4">
        <figure aria-labelledby="settlement-failure-figure">
          <figcaption className="sr-only" id="settlement-failure-figure">
            Failed settlements by window with an accessible data table below.
          </figcaption>
          <div className="space-y-2">
            {data.points.map((point) => {
              const value = point.failedCount;

              return (
                <div className="flex items-center gap-2" key={point.windowStart}>
                  <span className="w-16 shrink-0 text-xs text-slate-600">
                    {formatWindow(point)}
                  </span>
                  <div className="h-3 flex-1 rounded-sm bg-slate-100">
                    {value === null ? (
                      <span className="block px-1 text-[10px] leading-3 text-slate-500">
                        Unavailable
                      </span>
                    ) : (
                      <div
                        className="h-full rounded-sm bg-red-700"
                        style={{ width: `${value === 0 ? 0 : Math.max(4, (value / max) * 100)}%` }}
                      />
                    )}
                  </div>
                  <span className="w-20 shrink-0 text-right text-xs text-slate-700">
                    {value === null ? "Unavailable" : `${value} failed`}
                  </span>
                </div>
              );
            })}
          </div>
          <FailureTable points={data.points} />
        </figure>
      </CardBody>
    </Card>
  );
}

function LatencyTable({ points }: { points: SettlementTrendPoint[] }) {
  return (
    <table className="mt-4 w-full border-t border-slate-200 text-left text-xs">
      <caption className="sr-only">
        Settlement latency and counts by window. Unavailable values are not zero.
      </caption>
      <thead className="text-slate-500">
        <tr>
          <th className="py-2 font-medium" scope="col">
            Window (UTC)
          </th>
          <th className="py-2 font-medium" scope="col">
            p50
          </th>
          <th className="py-2 font-medium" scope="col">
            p95
          </th>
          <th className="py-2 font-medium" scope="col">
            Settled
          </th>
          <th className="py-2 font-medium" scope="col">
            Failed
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {points.map((point) => (
          <tr key={point.windowStart}>
            <th className="py-2 font-normal text-slate-700" scope="row">
              {formatWindow(point)}
            </th>
            <td className="py-2 text-slate-700">{formatMilliseconds(point.p50LatencyMs)}</td>
            <td className="py-2 text-slate-700">{formatMilliseconds(point.p95LatencyMs)}</td>
            <td className="py-2 text-slate-700">{formatCount(point.settledCount)}</td>
            <td className="py-2 text-slate-700">{formatCount(point.failedCount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FailureTable({ points }: { points: SettlementTrendPoint[] }) {
  return (
    <table className="mt-4 w-full border-t border-slate-200 text-left text-xs">
      <caption className="sr-only">
        Failed and settled settlements by window. Unavailable values are not zero.
      </caption>
      <thead className="text-slate-500">
        <tr>
          <th className="py-2 font-medium" scope="col">
            Window (UTC)
          </th>
          <th className="py-2 font-medium" scope="col">
            Failed
          </th>
          <th className="py-2 font-medium" scope="col">
            Settled
          </th>
          <th className="py-2 font-medium" scope="col">
            Failure rate
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {points.map((point) => (
          <tr key={point.windowStart}>
            <th className="py-2 font-normal text-slate-700" scope="row">
              {formatWindow(point)}
            </th>
            <td className="py-2 text-slate-700">{formatCount(point.failedCount)}</td>
            <td className="py-2 text-slate-700">{formatCount(point.settledCount)}</td>
            <td className="py-2 text-slate-700">{formatFailureRate(point)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatWindow(point: SettlementTrendPoint) {
  return utcDateFormatter.format(new Date(point.windowStart));
}

function formatMilliseconds(value: number | null) {
  return value === null ? "Unavailable" : `${value} ms`;
}

function formatCount(value: number | null) {
  return value === null ? "Unavailable" : String(value);
}

function formatFailureRate(point: SettlementTrendPoint) {
  if (point.failedCount === null || point.settledCount === null) {
    return "Unavailable";
  }

  const total = point.failedCount + point.settledCount;

  if (total === 0) {
    return "No attempts";
  }

  return `${((point.failedCount / total) * 100).toFixed(1)}%`;
}
