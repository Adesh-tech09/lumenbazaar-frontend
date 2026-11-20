# Route Error Boundaries

Playground, resource detail, transactions, and seller publishing define App Router `error.tsx`
files backed by the shared `RouteError` component.

## Behavior

- Each route renders an accessible recovery surface (`role="alert"`) with a route-specific title.
- The retry control calls the segment `reset` only. It never resubmits a payment, settlement, or
  publish mutation, so a retry cannot duplicate a payment or create a duplicate resource.
- When Next.js provides an error digest, it is displayed as the request identifier so a failure
  can be correlated without exposing stack traces or payloads.
- A failed payment is never presented as successful, and errors are not swallowed.

## Coverage

Component tests exercise both thrown render errors and query errors with a request identifier.
Browser coverage of API and render failures lives in `tests/outage-e2e`.
