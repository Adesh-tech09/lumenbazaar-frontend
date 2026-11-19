# Ledger-aware balance refresh

Balances and trustlines are refreshed only against confirmed ledger evidence,
never merely because a payment request returned.

## Refresh key

`balanceRefreshKey(receipt)` returns a stable key only when a receipt is
`finalized` and carries a positive integer `ledger`:

```
balances:<network>:<transaction hash or receipt id>:<ledger>
```

Pending and failed receipts have no refresh key and do not start Horizon reads.

## Horizon lag and request bounds

`refreshBalancesAfterPayment` polls Horizon with the shared bounded backoff
helper:

1. Read the latest closed ledger.
2. If it is below the receipt's confirming ledger, wait and retry (Horizon lag).
3. Once the confirming ledger is closed, read the account balances and
   trustlines once.

Default budget: 5 attempts, 750 ms initial delay, 8 s maximum delay, 20 s total.
Polling stops on:

- the confirming ledger (success),
- an aborted signal (timeout or component unmount),
- the attempt or elapsed-time budget (surfaced as a timeout when Horizon is
  still behind, or as a failure when Horizon repeatedly errors).

A failed refresh never throws into the UI; it returns a `failed` result with the
last error so the caller can offer a retry.
