"use client";

import { RouteError } from "@/components/layout/route-error";

export default function TransactionsError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      description="Transaction evidence could not render. No settlement action was taken."
      error={error}
      reset={reset}
      title="Transactions unavailable"
    />
  );
}
