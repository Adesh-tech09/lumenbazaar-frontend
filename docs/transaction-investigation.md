# Transaction investigation

The transactions workspace supports composable filters, local saved views, and a deep-linkable
detail panel.

## Filters and URL state

Filters are defined by `transactionFiltersSchema` in `src/services/transaction-filters.ts`:

| Parameter  | Values                                                 |
| ---------- | ------------------------------------------------------ |
| `status`   | `received`, `verified`, `pending`, `settled`, `failed` |
| `network`  | `stellar:testnet`, `stellar:pubnet`                    |
| `assets`   | Comma-separated alphanumeric asset codes               |
| `sellers`  | Comma-separated seller identifiers                     |
| `dateFrom` | `YYYY-MM-DD`, inclusive                                |
| `dateTo`   | `YYYY-MM-DD`, inclusive                                |

- Dates are valid calendar days and `dateFrom` must be on or before `dateTo`.
- Filters are validated before a query runs. An invalid draft renders an inline alert and does not
  issue a request.
- `withTransactionFilters` rewrites only filter keys, preserving `cursor`, `direction`, and
  `transaction`. Existing cursor semantics and shared detail links therefore survive filter edits.
- Legacy `asset`, `sellerId`, and `date` params are accepted when read; `date` maps to an inclusive
  single-day range.

## Saved views

Saved views are local-only (`lumenbazaar.frontend.transaction-views.v1`) and validated on load and
save. They store filters only — never cursors or payment payloads. Applying a view restores its
filters and restarts the list at the first page; cursor navigation continues to work normally.

## Detail panel

Selecting **View details** adds `?transaction=<attempt-id>` to the URL. The panel:

- keeps the transaction list mounted and preserves its scroll position
- copies filter and cursor params into shareable links without adding private data
- closes on Escape or the close button, then restores focus to the originating row trigger
- distinguishes **Transaction not found** from **Transaction not authorized** (records whose seller
  is outside the reviewed workspace) instead of rendering an empty record

## Coverage

- `src/services/transaction-filters.test.ts` covers boundary dates, multiple assets and sellers,
  validation failures, URL round-tripping with cursors, and saved-view storage.
- `src/services/transaction-detail.test.ts` covers found, missing, unauthorized, and URL helper
  behavior.
