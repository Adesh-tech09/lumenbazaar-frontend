# Local Bookmarks and Recently Viewed

Buyers can keep a short list of resources they want to revisit. Both lists are stored in
`localStorage` for the current browser profile:

- `lumenbazaar.frontend.bookmarks.v1` — up to 20 bookmarked resources
- `lumenbazaar.frontend.recently-viewed.v1` — the 10 most recently inspected resources

## Behavior

- Saving a resource from its detail page toggles a local bookmark. The control announces the
  change and exposes `aria-pressed`.
- Opening a resource detail page records the resource at the front of the recent list.
- `/resources` lists both collections with per-item remove controls and clear-all controls.
- Storage is validated before use. Corrupt values are ignored rather than crashing the view.
- Removed or unavailable resources still render their locally saved name and link. The detail
  page reports the resource as unavailable; no stored payment terms are shown as current.

## Not included

- No server-side persistence, account sync, or wallet association.
- No bookmark counts are sent to telemetry.
