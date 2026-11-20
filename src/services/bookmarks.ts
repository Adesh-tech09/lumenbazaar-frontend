import { z } from "zod";

/**
 * Local-only bookmarks and recently viewed resources.
 *
 * Nothing here is persisted server-side: entries live in `localStorage` and are
 * scoped to one browser profile. Lists are bounded so a long browsing session
 * cannot grow storage without limit.
 */

export const maxBookmarks = 20;
export const maxRecentlyViewed = 10;

export const bookmarkStorageKey = "lumenbazaar.frontend.bookmarks.v1";
export const recentStorageKey = "lumenbazaar.frontend.recently-viewed.v1";
export const savedResourcesChangeEvent = "lumenbazaar:local-saved-resources";

/** Notifies same-tab listeners after a local write. */
export function notifySavedResourcesChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(savedResourcesChangeEvent));
}

const entrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  savedAt: z.string().min(1)
});

const entriesSchema = z.array(entrySchema);

export type SavedResourceEntry = z.infer<typeof entrySchema>;

type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

function browserStorage(): StorageLike | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.localStorage;
}

function load(key: string, storage: StorageLike | undefined, limit: number) {
  if (storage === undefined) return [];
  const raw = storage.getItem(key);
  if (raw === null) return [];

  try {
    const parsed = entriesSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data.slice(0, limit) : [];
  } catch {
    return [];
  }
}

function store(key: string, entries: SavedResourceEntry[], storage: StorageLike | undefined) {
  storage?.setItem(key, JSON.stringify(entries));
  return entries;
}

function upsert(entries: SavedResourceEntry[], entry: { id: string; name: string }, limit: number) {
  const next = [
    { id: entry.id, name: entry.name, savedAt: new Date().toISOString() },
    ...entries.filter((candidate) => candidate.id !== entry.id)
  ];

  return next.slice(0, limit);
}

export function loadBookmarks(storage: StorageLike | undefined = browserStorage()) {
  return load(bookmarkStorageKey, storage, maxBookmarks);
}

export function isBookmarked(
  id: string,
  storage: StorageLike | undefined = browserStorage()
): boolean {
  return loadBookmarks(storage).some((entry) => entry.id === id);
}

/** Adds or removes a bookmark. Returns the resulting bookmark list. */
export function toggleBookmark(
  entry: { id: string; name: string },
  storage: StorageLike | undefined = browserStorage()
) {
  const current = loadBookmarks(storage);
  const next = current.some((candidate) => candidate.id === entry.id)
    ? current.filter((candidate) => candidate.id !== entry.id)
    : upsert(current, entry, maxBookmarks);

  return store(bookmarkStorageKey, next, storage);
}

export function removeBookmark(id: string, storage: StorageLike | undefined = browserStorage()) {
  const next = loadBookmarks(storage).filter((entry) => entry.id !== id);
  return store(bookmarkStorageKey, next, storage);
}

export function clearBookmarks(storage: StorageLike | undefined = browserStorage()) {
  storage?.removeItem(bookmarkStorageKey);
  return [];
}

export function loadRecentlyViewed(storage: StorageLike | undefined = browserStorage()) {
  return load(recentStorageKey, storage, maxRecentlyViewed);
}

/** Records a resource view, moving a repeat visit to the front of the list. */
export function recordRecentlyViewed(
  entry: { id: string; name: string },
  storage: StorageLike | undefined = browserStorage()
) {
  const next = upsert(loadRecentlyViewed(storage), entry, maxRecentlyViewed);
  return store(recentStorageKey, next, storage);
}

export function removeRecentlyViewed(
  id: string,
  storage: StorageLike | undefined = browserStorage()
) {
  const next = loadRecentlyViewed(storage).filter((entry) => entry.id !== id);
  return store(recentStorageKey, next, storage);
}

export function clearRecentlyViewed(storage: StorageLike | undefined = browserStorage()) {
  storage?.removeItem(recentStorageKey);
  return [];
}
