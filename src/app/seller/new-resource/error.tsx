"use client";

import { RouteError } from "@/components/layout/route-error";

export default function SellerPublishError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      description="The resource editor could not render. No resource was published or retried."
      error={error}
      reset={reset}
      title="Resource publishing unavailable"
    />
  );
}
