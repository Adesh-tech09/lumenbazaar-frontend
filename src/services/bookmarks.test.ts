import { describe, expect, it } from "vitest";

import {
  bookmarkStorageKey,
  clearBookmarks,
  clearRecentlyViewed,
  isBookmarked,
  loadBookmarks,
  loadRecentlyViewed,
  maxBookmarks,
  maxRecentlyViewed,
  recentStorageKey,
  recordRecentlyViewed,
  removeBookmark,
  removeRecentlyViewed,
  toggleBookmark
} from "./bookmarks";

function memoryStorage() {
  const values = new Map<string, string>();

  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value)
  };
}

describe("local bookmarks", () => {
  it("survives a reload by reading persisted entries", () => {
    const storage = memoryStorage();

    toggleBookmark({ id: "resource_weather", name: "Paid Weather API" }, storage);

    expect(loadBookmarks(storage)).toEqual([
      expect.objectContaining({ id: "resource_weather", name: "Paid Weather API" })
    ]);
    expect(isBookmarked("resource_weather", storage)).toBe(true);
  });

  it("toggles and removes a single bookmark", () => {
    const storage = memoryStorage();
    toggleBookmark({ id: "a", name: "A" }, storage);
    toggleBookmark({ id: "a", name: "A" }, storage);
    expect(loadBookmarks(storage)).toEqual([]);

    toggleBookmark({ id: "a", name: "A" }, storage);
    expect(removeBookmark("a", storage)).toEqual([]);
  });

  it("caps the bookmark list at the documented limit", () => {
    const storage = memoryStorage();

    for (let index = 0; index < maxBookmarks + 5; index += 1) {
      toggleBookmark({ id: `resource_${index}`, name: `Resource ${index}` }, storage);
    }

    const bookmarks = loadBookmarks(storage);
    expect(bookmarks).toHaveLength(maxBookmarks);
    expect(bookmarks[0]?.id).toBe(`resource_${maxBookmarks + 4}`);
  });

  it("clears every bookmark", () => {
    const storage = memoryStorage();
    toggleBookmark({ id: "a", name: "A" }, storage);
    toggleBookmark({ id: "b", name: "B" }, storage);

    expect(clearBookmarks(storage)).toEqual([]);
    expect(storage.getItem(bookmarkStorageKey)).toBeNull();
  });

  it("ignores corrupt or missing storage values", () => {
    const storage = memoryStorage();
    storage.setItem(bookmarkStorageKey, "{not json");

    expect(loadBookmarks(storage)).toEqual([]);
    expect(loadBookmarks(undefined)).toEqual([]);
  });
});

describe("recently viewed history", () => {
  it("moves a repeat view to the front and caps the list", () => {
    const storage = memoryStorage();

    for (let index = 0; index < maxRecentlyViewed + 3; index += 1) {
      recordRecentlyViewed({ id: `resource_${index}`, name: `Resource ${index}` }, storage);
    }

    const recent = loadRecentlyViewed(storage);
    expect(recent).toHaveLength(maxRecentlyViewed);
    expect(recent[0]?.id).toBe(`resource_${maxRecentlyViewed + 2}`);

    recordRecentlyViewed({ id: "resource_1", name: "Resource 1" }, storage);
    expect(loadRecentlyViewed(storage)[0]?.id).toBe("resource_1");
  });

  it("removes one entry and clears the whole list", () => {
    const storage = memoryStorage();
    recordRecentlyViewed({ id: "a", name: "A" }, storage);
    recordRecentlyViewed({ id: "b", name: "B" }, storage);

    expect(removeRecentlyViewed("a", storage).map((entry) => entry.id)).toEqual(["b"]);
    expect(clearRecentlyViewed(storage)).toEqual([]);
    expect(storage.getItem(recentStorageKey)).toBeNull();
  });
});
