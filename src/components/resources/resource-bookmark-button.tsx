"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import {
  isBookmarked,
  notifySavedResourcesChanged,
  savedResourcesChangeEvent,
  toggleBookmark
} from "@/services/bookmarks";

function subscribeToBookmarks(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(savedResourcesChangeEvent, onChange);

  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(savedResourcesChangeEvent, onChange);
  };
}

export function ResourceBookmarkButton({ resourceId, name }: { resourceId: string; name: string }) {
  const bookmarked = useSyncExternalStore(
    subscribeToBookmarks,
    () => isBookmarked(resourceId),
    () => false
  );
  const [announcement, setAnnouncement] = useState("");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        aria-pressed={bookmarked}
        onClick={() => {
          const bookmarks = toggleBookmark({ id: resourceId, name });
          const next = bookmarks.some((entry) => entry.id === resourceId);
          notifySavedResourcesChanged();
          setAnnouncement(
            next ? `${name} saved to local bookmarks.` : `${name} removed from bookmarks.`
          );
        }}
        type="button"
        variant="secondary"
      >
        {bookmarked ? (
          <BookmarkCheck aria-hidden="true" className="h-4 w-4" />
        ) : (
          <Bookmark aria-hidden="true" className="h-4 w-4" />
        )}
        {bookmarked ? "Saved locally" : "Save locally"}
      </Button>
      <span aria-live="polite" className="sr-only" role="status">
        {announcement}
      </span>
      <span className="text-xs text-slate-500">Stored in this browser only.</span>
    </div>
  );
}
