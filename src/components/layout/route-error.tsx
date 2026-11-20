"use client";

import { ErrorState } from "@/components/ui/surfaces";

export type RouteErrorProps = {
  code?: string;
  description: string;
  error: Error & { digest?: string };
  reset: () => void;
  title: string;
};

/**
 * Shared render for App Router `error.tsx` files on payment-critical routes.
 *
 * `reset` re-renders the route segment only. It never re-submits a payment or a
 * publish mutation, so retrying cannot duplicate a settlement or publication.
 */
export function RouteError({
  code = "ROUTE_ERROR",
  description,
  error,
  reset,
  title
}: RouteErrorProps) {
  const requestId =
    typeof error.digest === "string" && error.digest.length > 0 ? error.digest : undefined;

  return (
    <div className="space-y-3">
      <ErrorState
        code={code}
        description={description}
        onRetry={reset}
        requestId={requestId}
        title={title}
      />
      <p className="text-xs text-slate-500">
        Retry reloads this view only. Payment and publishing actions are never repeated
        automatically.
      </p>
    </div>
  );
}
