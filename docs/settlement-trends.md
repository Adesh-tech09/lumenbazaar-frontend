# Settlement latency and failure trends

The dashboard plots typed settlement aggregates rather than deriving incidents from a single page of
transactions.

## Data contract

`loadSettlementTrends` in `src/services/dashboard.ts` accepts a server payload with:

- `window`: `24h`, `7d`, or `30d`
- `windowLabel`: a human-readable description of the aggregate windows
- `points`: per-window `p50LatencyMs`, `p95LatencyMs`, `settledCount`, and `failedCount`
  (each may be `null`), plus `windowStart` and `windowEnd`

Payloads are validated before rendering. Live modes fail closed when the backend does not expose the
aggregate or returns an invalid payload; they never substitute local calculations, fixtures, or
zeroes.

Explicit `demo` mode uses `demoSettlementTrends` and labels the result **Explicit demo aggregates**.
That fixture intentionally includes one incomplete window so partial states are exercised.

## States

| State                    | Rendering                                                                        |
| ------------------------ | -------------------------------------------------------------------------------- |
| Available server data    | Latency and failure charts, each with a visible accessible data table            |
| Incomplete windows       | `Some windows unavailable` badge; affected cells read **Unavailable**, never `0` |
| Aggregate unavailable    | An **Unavailable** card states that unavailable windows are not zero incidents   |
| Invalid payload or error | Same fail-closed unavailable card with a retry action                            |

## Accessibility

Every chart is a `<figure>` with a caption and a visible `<table>` equivalent listing each window,
latency percentiles, settled count, failed count, and failure rate. Tables use row and column
headers; unavailable values are rendered as text rather than omitted.

## Coverage

- `src/services/dashboard.test.ts` covers server aggregate validation, unsupported and invalid
  payloads, demo labeling, and incomplete-window detection.
- `src/components/dashboard/settlement-trends.tsx` contains the charts and tables.
