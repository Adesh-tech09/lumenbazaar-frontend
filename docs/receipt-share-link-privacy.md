# Receipt share-link privacy

Receipt detail pages include a two-step sharing flow:

1. **Review share link** shows every field placed in the link, the fields a
   recipient can see on the public receipt page, and the fields excluded from
   sharing.
2. **Copy link** / **Share…** only become available after the review step.

## What the link contains

The generated URL is built from the receipt identifier alone:

```
/receipts/<url-encoded receipt id>
```

No query string or fragment is ever added, so local filters, pagination state,
or other private query state cannot leak through a copied link.

## Excluded data

- Payment attempt ID
- Correlation ID
- Evidence hash
- Seller and resource IDs
- Wallet addresses and authorization data
- Private query or filter state

## Failure handling

- Clipboard failures keep the link visible and selectable, with instructions to
  copy it manually.
- Native share refusals or unsupported browsers fall back to the visible link and
  the copy action.

Implementation: `src/services/receipt-share.ts` and
`src/components/receipts/receipt-share-panel.tsx`.
