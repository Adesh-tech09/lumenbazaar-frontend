"use client";

import { RouteError } from "@/components/layout/route-error";

export default function PlaygroundError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      description="The payment playground could not render. No payment was submitted or retried."
      error={error}
      reset={reset}
      title="Payment playground unavailable"
    />
  );
}
