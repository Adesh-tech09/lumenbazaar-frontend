# Resource version editing

Editing loads the current resource version from the API, compares it to the draft, and
publishes a new version against the reviewed `updatedAt`.

## Flow

1. `/seller/new-resource?resourceId=<id>` loads the current version
   (`loadResourceForEdit`). A preserved local draft, if any, takes precedence over the server
   copy.
2. The wizard adds a **Review changes** step with a field-level diff:
   name, description, type, endpoint, route template, network, asset, amount, recipient,
   schemas, and extensions.
3. Endpoint and payment-term changes are highlighted in a **Payment-critical changes** panel.
   Nothing is published until the reviewer ticks the confirmation checkbox.
4. Publishing calls `saveResourceEdit`, which validates first and short-circuits unchanged
   drafts without a request.

## Draft portability and unsaved changes

New-resource drafts can be exported with **Export draft** and reloaded with **Import draft**.
Files carry a `version` of `1`, an `exportedAt` timestamp, and an allowlisted `draft` object;
session tokens, signed payloads, private keys, and other fields outside the draft schema are never
exported or trusted on import. Imports are rejected when the file exceeds 64 KB, uses an unknown
version, is not valid JSON, or fails draft validation.

The wizard compares the draft with the version it was loaded from using
`hasMeaningfulDraftChanges`, which ignores whitespace-only edits, key ordering, timestamps, and
status. While that comparison is dirty, a `beforeunload` guard covers reloads and tab closes and
a capture-phase click guard confirms in-app links; **Save and exit** confirms too, and **Discard
draft** clears both local storage and the dirty state.

## Optimistic concurrency

`saveResourceEdit` sends the `updatedAt` of the reviewed version. If the server has a newer
version:

- `VERSION_CONFLICT` is raised and no write occurs;
- the draft is preserved in wizard state and in `lumenbazaar_resource_edit_draft:<id>`;
- the reviewer must either **Reload server version** (discarding the local draft) or tick the
  explicit overwrite confirmation and publish over the newer version.

A newer server version is never overwritten silently.

## Backend capability

The pinned backend OpenAPI document exposes no resource update endpoint. Live modes fail
closed with `UNSUPPORTED_CAPABILITY` and preserve the draft. Explicit demo mode persists
versions in an in-session store.
