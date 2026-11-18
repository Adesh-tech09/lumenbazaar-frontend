# Offline and degraded-network status banner

The app shell renders a global banner when the browser is offline or when the read-only service
checks cannot confirm that the backend and Stellar dependencies are operational. Network loss is
reported once at the top of the page instead of as unrelated component errors on payment routes.

## State sources

The banner separates the three sources of connectivity state:

| Source      | Signal                                                         | Timestamp shown         |
| ----------- | -------------------------------------------------------------- | ----------------------- |
| Browser     | `navigator.onLine` plus the window `online` / `offline` events | Last browser state read |
| Backend API | `GET /health` and `GET /ready`                                 | Last probe completion   |
| Stellar     | The `stellarRpc` and `horizon` checks in `GET /ready`          | Last probe completion   |

`assessNetworkStatus()` in `src/services/operators.ts` combines these signals. The browser is
authoritative for offline state: while offline, the backend and Stellar rows show
`Paused while offline` and never imply that a degraded backend caused the outage.

Levels are:

- `offline` — the browser has no network connection.
- `degraded` — the browser is online, but backend or Stellar readiness is degraded or unavailable.
- `unverifiable` — the browser is online, but readiness could not be confirmed.
- `checking` — the first probe is still in flight; no banner is shown.
- `operational` — all checks pass; no banner is shown.

In explicit demo mode (`NEXT_PUBLIC_LUMENBAZAAR_ENV=demo`) no network probe runs; bundled readiness
is reported as operational, while the browser offline state is still detected.

## Recovery does not replay unsafe mutations

`probeNetworkStatus()` performs `GET` requests only. The banner's `Re-check status` action refetches
that probe and nothing else. It never invalidates queries, replays a payment verification or
settlement request, or retries a mutation automatically. The query client also disables mutation
retries and uses `networkMode: "always"` for mutations (`src/services/api/query.ts`), so an offline
mutation fails closed instead of being queued and resumed on reconnect. Users must deliberately
retry a payment through its own flow.

Probing pauses while the browser is offline and resumes when the `online` event fires.

## Accessible, deduplicated announcements

- The visible banner is a labelled `region`; its title is referenced with `aria-labelledby`.
- A persistent visually hidden `role="status"` live region announces state changes. Offline uses
  `aria-live="assertive"`; degraded and recovery use `aria-live="polite"`.
- `networkAnnouncementKey()` excludes timestamps and volatile details, so repeated 60-second polls
  of the same state do not re-announce. `nextNetworkAnnouncement()` returns a message only when the
  state key changes, stays silent on the first healthy load, and announces recovery only after a
  prior offline or degraded notice.
- Both the banner and the re-check control are responsive: the content stacks on mobile and moves to
  a row with the action on wider viewports.

## Coverage

- `src/services/operators.test.ts` covers probe outcomes, demo mode, the distinction between offline
  and degraded states, announcement keys, repeat-poll deduplication, and recovery announcements.
- `src/components/layout/network-status-banner.test.tsx` covers the hidden healthy state, visible
  source status and timestamps, offline rendering with paused probes, and re-checking without
  duplicate announcements.
