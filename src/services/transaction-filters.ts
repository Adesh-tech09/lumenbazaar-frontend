import { z } from "zod";

import type { PaymentActivityFilters, PaymentActivityStatus } from "@/services/payments";

/**
 * Composable transaction filters shared by the URL, saved views, and the
 * payment activity query. Every value is validated before it reaches a query.
 */

export const transactionStatuses = [
  "received",
  "verified",
  "pending",
  "settled",
  "failed"
] as const satisfies readonly PaymentActivityStatus[];

export const transactionNetworks = ["stellar:testnet", "stellar:pubnet"] as const;

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const dateSchema = z
  .string()
  .regex(datePattern, "Dates must use YYYY-MM-DD")
  .refine(isCalendarDate, "Date is not a valid calendar day");

const assetSchema = z
  .string()
  .trim()
  .min(1, "Asset codes cannot be empty")
  .max(12, "Asset codes are limited to 12 characters")
  .regex(/^[A-Za-z0-9]+$/, "Asset codes must be alphanumeric");

const sellerSchema = z
  .string()
  .trim()
  .min(1, "Seller identifiers cannot be empty")
  .max(120, "Seller identifiers are too long");

export const transactionFiltersSchema = z
  .object({
    assets: z.array(assetSchema).max(20).optional(),
    dateFrom: dateSchema.optional(),
    dateTo: dateSchema.optional(),
    network: z.enum(transactionNetworks).optional(),
    sellers: z.array(sellerSchema).max(20).optional(),
    status: z.enum(transactionStatuses).optional()
  })
  .strict()
  .refine(
    (filters) =>
      filters.dateFrom === undefined ||
      filters.dateTo === undefined ||
      filters.dateFrom <= filters.dateTo,
    {
      message: "The start date must be on or before the end date.",
      path: ["dateTo"]
    }
  );

export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;

const savedTransactionViewSchema = z
  .object({
    createdAt: z.string(),
    filters: transactionFiltersSchema,
    id: z.string().min(1),
    name: z.string().trim().min(1).max(60)
  })
  .strict();

const savedTransactionViewsSchema = z.array(savedTransactionViewSchema).max(20);

export type SavedTransactionView = z.infer<typeof savedTransactionViewSchema>;

export const SAVED_VIEWS_STORAGE_KEY = "lumenbazaar.frontend.transaction-views.v1";
export const MAX_SAVED_VIEWS = 20;

const filterParamKeys = [
  "asset",
  "assets",
  "date",
  "dateFrom",
  "dateTo",
  "network",
  "sellerId",
  "sellers",
  "status"
] as const;

/**
 * Parses a raw filter object and reports validation errors instead of querying.
 */
export function validateTransactionFilters(input: unknown) {
  return transactionFiltersSchema.safeParse(input);
}

/**
 * Reads filters from a URL. Unknown params such as `cursor`, `direction`, and
 * `transaction` are left untouched so pagination and detail links survive.
 */
export function parseTransactionFilterParams(params: URLSearchParams): {
  errors: string[];
  filters: TransactionFilters;
} {
  const assets = splitList(params.get("assets") ?? params.get("asset"));
  const sellers = splitList(params.get("sellers") ?? params.get("sellerId"));
  const legacyDate = params.get("date") ?? undefined;

  const candidate = {
    ...(assets.length > 0 ? { assets } : {}),
    ...((params.get("dateFrom") ?? legacyDate)
      ? { dateFrom: params.get("dateFrom") ?? legacyDate ?? undefined }
      : {}),
    ...((params.get("dateTo") ?? legacyDate)
      ? { dateTo: params.get("dateTo") ?? legacyDate ?? undefined }
      : {}),
    ...(params.get("network") ? { network: params.get("network") } : {}),
    ...(sellers.length > 0 ? { sellers } : {}),
    ...(params.get("status") ? { status: params.get("status") } : {})
  };

  const result = validateTransactionFilters(candidate);

  if (!result.success) {
    return {
      errors: result.error.issues.map((issue) => issue.message),
      filters: {}
    };
  }

  return { errors: [], filters: result.data };
}

/**
 * Writes validated filters into a URL while preserving `cursor`, `direction`,
 * and other unrelated params. Saved views never store cursor state.
 */
export function withTransactionFilters(
  current: URLSearchParams,
  filters: TransactionFilters
): URLSearchParams {
  const next = new URLSearchParams(current);

  for (const key of filterParamKeys) {
    next.delete(key);
  }

  if (filters.status) {
    next.set("status", filters.status);
  }
  if (filters.network) {
    next.set("network", filters.network);
  }
  if (filters.assets && filters.assets.length > 0) {
    next.set("assets", filters.assets.join(","));
  }
  if (filters.sellers && filters.sellers.length > 0) {
    next.set("sellers", filters.sellers.join(","));
  }
  if (filters.dateFrom) {
    next.set("dateFrom", filters.dateFrom);
  }
  if (filters.dateTo) {
    next.set("dateTo", filters.dateTo);
  }

  return next;
}

/**
 * Converts validated filters into the payment service query shape.
 */
export function toPaymentActivityFilters(filters: TransactionFilters): PaymentActivityFilters {
  return {
    ...(filters.assets && filters.assets.length > 0 ? { assets: filters.assets } : {}),
    ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
    ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
    ...(filters.network ? { network: filters.network } : {}),
    ...(filters.sellers && filters.sellers.length > 0 ? { sellerIds: filters.sellers } : {}),
    ...(filters.status ? { status: filters.status } : {})
  };
}

const EMPTY_SAVED_VIEWS: SavedTransactionView[] = [];
const savedViewListeners = new Set<() => void>();
let cachedSavedViews: SavedTransactionView[] | undefined;

export function subscribeSavedViews(listener: () => void): () => void {
  savedViewListeners.add(listener);
  return () => savedViewListeners.delete(listener);
}

export function getSavedViewsSnapshot(): SavedTransactionView[] {
  cachedSavedViews ??= loadSavedViews();
  return cachedSavedViews;
}

export function getEmptySavedViewsSnapshot(): SavedTransactionView[] {
  return EMPTY_SAVED_VIEWS;
}

function publishSavedViews(views: SavedTransactionView[]): void {
  cachedSavedViews = views;
  for (const listener of savedViewListeners) {
    listener();
  }
}

export function loadSavedViews(
  storage: StorageLike | undefined = browserStorage()
): SavedTransactionView[] {
  if (storage === undefined) {
    return [];
  }

  const raw = storage.getItem(SAVED_VIEWS_STORAGE_KEY);

  if (raw === null) {
    return [];
  }

  try {
    return savedTransactionViewsSchema.parse(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveSavedView(
  name: string,
  filters: unknown,
  storage: StorageLike | undefined = browserStorage()
): SavedTransactionView {
  const parsedName = name.trim();

  if (parsedName.length === 0) {
    throw new Error("A view name is required.");
  }

  if (parsedName.length > 60) {
    throw new Error("View names are limited to 60 characters.");
  }

  const parsedFilters = transactionFiltersSchema.parse(filters);
  const views = loadSavedViews(storage);
  const view: SavedTransactionView = {
    createdAt: new Date().toISOString(),
    filters: parsedFilters,
    id: createViewId(),
    name: parsedName
  };

  const next = [...views, view].slice(-MAX_SAVED_VIEWS);
  storage?.setItem(SAVED_VIEWS_STORAGE_KEY, JSON.stringify(next));
  publishSavedViews(next);

  return view;
}

export function deleteSavedView(
  id: string,
  storage: StorageLike | undefined = browserStorage()
): SavedTransactionView[] {
  const next = loadSavedViews(storage).filter((view) => view.id !== id);
  storage?.setItem(SAVED_VIEWS_STORAGE_KEY, JSON.stringify(next));
  publishSavedViews(next);
  return next;
}

export function findSavedView(
  id: string,
  storage: StorageLike | undefined = browserStorage()
): SavedTransactionView | undefined {
  return loadSavedViews(storage).find((view) => view.id === id);
}

function splitList(value: string | null): string[] {
  if (value === null) {
    return [];
  }

  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ];
}

function isCalendarDate(value: string): boolean {
  if (!datePattern.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function createViewId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `view_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

function browserStorage(): StorageLike | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.localStorage;
}
