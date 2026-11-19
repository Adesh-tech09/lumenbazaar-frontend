import { QueryClient } from "@tanstack/react-query";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: {
        // Connectivity recovery only re-runs the read-only status probe. Unsafe
        // mutations must be retried deliberately by the user, never automatically.
        // `always` also prevents React Query from queueing a mutation while
        // offline and resuming it on reconnect.
        networkMode: "always",
        retry: false
      },
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
        staleTime: 30_000
      }
    }
  });
}

export const queryKeys = {
  comparison: (resourceIds: string[]) => ["comparison", resourceIds] as const,
  conformance: ["conformance"] as const,
  dashboard: ["dashboard"] as const,
  settlementTrends: ["settlement-trends"] as const,
  health: ["health"] as const,
  networks: ["networks"] as const,
  networkStatus: ["network-status"] as const,
  operators: ["operators"] as const,
  resources: (filters: Record<string, unknown>) => ["resources", filters] as const,
  search: (filters: Record<string, unknown>) => ["search", filters] as const,
  sellers: ["sellers"] as const,
  supported: ["supported"] as const,
  // Cursor-paginated queries
  transactions: (
    filters: Record<string, unknown>,
    cursor?: string,
    direction?: "forward" | "backward"
  ) => ["transactions", filters, cursor, direction] as const,
  sellerPayments: (sellerId: string, cursor?: string, direction?: "forward" | "backward") =>
    ["sellerPayments", sellerId, cursor, direction] as const
};
