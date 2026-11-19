import type { Receipt } from "@/services/api/schemas";

/**
 * A field named in the share review step. Only allowlisted public fields are
 * ever described as included in a shared receipt link.
 */
export type ReceiptShareField = {
  label: string;
  value: string;
};

export type ReceiptSharePlan = {
  /** Fields placed in the generated URL. */
  linkFields: readonly ReceiptShareField[];
  /** Fields visible to the recipient on the public receipt page. */
  recipientVisibleFields: readonly ReceiptShareField[];
  /** Fields deliberately kept out of the link and review copy. */
  excludedFields: readonly string[];
  /** Minimum public receipt reference embedded in the link. */
  publicReference: string;
  /** Relative link, containing no query or fragment state. */
  path: string;
  /** Absolute link when an origin is supplied. */
  url: string;
};

/**
 * Fields that are never part of a receipt share link. Private payment,
 * correlation, and wallet data stays in the authenticated application.
 */
export const receiptShareExcludedFields: readonly string[] = [
  "Payment attempt ID",
  "Correlation ID",
  "Evidence hash",
  "Seller ID",
  "Resource ID",
  "Wallet addresses and authorization",
  "Any private query or filter state"
];

/**
 * Builds the public share plan for a receipt.
 *
 * The link is constructed from the receipt identifier alone, so query strings,
 * fragments, and other locally held state cannot leak into a shared URL.
 */
export function buildReceiptSharePlan(
  receipt: Pick<Receipt, "id" | "status" | "network" | "amount" | "assetCode">,
  origin?: string
): ReceiptSharePlan {
  const publicReference = receipt.id;
  const path = `/receipts/${encodeURIComponent(publicReference)}`;
  const base = origin?.replace(/\/+$/, "");

  return {
    excludedFields: receiptShareExcludedFields,
    linkFields: [{ label: "Receipt reference", value: publicReference }],
    path,
    publicReference,
    recipientVisibleFields: [
      { label: "Receipt status", value: receipt.status },
      { label: "Network", value: receipt.network },
      { label: "Amount and asset", value: `${receipt.amount} ${receipt.assetCode}` }
    ],
    url: base ? `${base}${path}` : path
  };
}

/**
 * Returns true when a link contains only the public receipt path and no query
 * or fragment state. Used by the share review step to keep generated links
 * honest.
 */
export function isMinimumReceiptShareLink(link: string) {
  return !link.includes("?") && !link.includes("#");
}
