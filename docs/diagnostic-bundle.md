# Redacted payment diagnostic bundle

Support bundles are generated locally from an explicit allowlist in `src/services/diagnostics.ts`.
The user reviews the serialized bundle before downloading it.

## Allowlist

Only these sections are assembled:

- App version and runtime environment
- Network, source (`demo` or `live`), generated timestamp, and schema version
- Allowlisted active filter keys (`network`, `status`, `assets`, `asset`, `sellerIds`, `sellerId`,
  `dateFrom`, `dateTo`, `date`, `resourceType`)
- Allowlisted transaction fields: attempt identifier, created time, network, asset code, amount,
  status, masked seller/resource/receipt/settlement/correlation identifiers, failure code and
  redacted reason, receipt status, transaction hash marker, and ledger
- Telemetry events reduced to event type, timestamp, network, and the event type's existing
  telemetry allowlist
- Safe response headers only: `content-type`, `x-request-id`, `x-correlation-id`,
  `x-ratelimit-remaining`

Unknown input fields are dropped. `authorization`, `cookie`, `proxy-authorization`, `set-cookie`,
and `x-payment-signature` headers are never copied.

## Redaction rules

| Input                                                     | Output                                                |
| --------------------------------------------------------- | ----------------------------------------------------- |
| Stellar `G…` account or `S…` secret key                   | `[redacted-stellar-key]`                              |
| 64+ character hexadecimal hash                            | `[redacted-hash]`                                     |
| Bearer token, JWT-shaped value, authorization header      | `[redacted-token]`                                    |
| Email address                                             | `[redacted-email]`                                    |
| Attempt/seller/resource/receipt/settlement/correlation ID | first four and last four characters, separated by `…` |
| Identifier shorter than 12 characters                     | `[redacted-identifier]`                               |

The bundle includes the rules above so reviewers know what was removed. Tests seed a wallet key,
secret key, transaction hash, email address, bearer token, cookie, and unknown field, then assert
none of the seeded values appear in the serialized output.

## Usage

The transactions page exposes **Review diagnostics**. It builds the bundle, shows the JSON in a
review panel, and only offers a download after the user has seen the redacted content.

## Coverage

- `src/services/diagnostics.test.ts` covers allowlisted transaction fields, telemetry field
  reduction, identifier masking, header filtering, and seeded sensitive-value removal.
