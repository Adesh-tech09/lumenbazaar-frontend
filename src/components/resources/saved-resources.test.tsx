import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import {
  bookmarkStorageKey,
  loadBookmarks,
  loadRecentlyViewed,
  recordRecentlyViewed,
  recentStorageKey,
  toggleBookmark
} from "@/services/bookmarks";

import { SavedResources } from "./saved-resources";

beforeEach(() => {
  window.localStorage.clear();
});

describe("SavedResources", () => {
  it("renders persisted bookmarks and recent history after reload", () => {
    toggleBookmark({ id: "resource_weather", name: "Paid Weather API" });
    toggleBookmark({ id: "resource_deleted", name: "Removed Resource" });
    recordRecentlyViewed({ id: "resource_rag", name: "Stellar RAG Search" });

    render(<SavedResources />);

    expect(screen.getByRole("link", { name: "Paid Weather API" })).toHaveAttribute(
      "href",
      "/resources/resource_weather"
    );
    expect(screen.getByRole("link", { name: "Removed Resource" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Stellar RAG Search" })).toBeInTheDocument();
  });

  it("removes a single bookmark and clears recent history", async () => {
    toggleBookmark({ id: "a", name: "Resource A" });
    toggleBookmark({ id: "b", name: "Resource B" });
    recordRecentlyViewed({ id: "recent", name: "Recent Resource" });

    render(<SavedResources />);

    await userEvent.click(screen.getByRole("button", { name: "Remove Resource A" }));
    expect(loadBookmarks().map((entry) => entry.id)).toEqual(["b"]);
    expect(window.localStorage.getItem(recentStorageKey)).not.toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Clear history" }));
    expect(loadRecentlyViewed()).toEqual([]);
    expect(window.localStorage.getItem(recentStorageKey)).toBeNull();
  });

  it("clears all bookmarks", async () => {
    toggleBookmark({ id: "a", name: "Resource A" });
    toggleBookmark({ id: "b", name: "Resource B" });

    render(<SavedResources />);
    await userEvent.click(screen.getByRole("button", { name: "Clear bookmarks" }));

    expect(loadBookmarks()).toEqual([]);
    expect(window.localStorage.getItem(bookmarkStorageKey)).toBeNull();
  });
});
