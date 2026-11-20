"use client";

import { RouteError } from "@/components/layout/route-error";

export default function ResourceDetailError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      description="Resource payment terms could not render. Nothing was purchased or retried."
      error={error}
      reset={reset}
      title="Resource detail unavailable"
    />
  );
}
