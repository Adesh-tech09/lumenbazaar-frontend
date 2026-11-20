"use client";

import { Bookmark, Clock, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/surfaces";
import {
  bookmarkStorageKey,
  clearBookmarks,
  clearRecentlyViewed,
  loadBookmarks,
  loadRecentlyViewed,
  notifySavedResourcesChanged,
  removeBookmark,
  recentStorageKey,
  removeRecentlyViewed,
  savedResourcesChangeEvent,
  type SavedResourceEntry
} from "@/services/bookmarks";

const emptyEntries: SavedResourceEntry[] = [];

let bookmarksSnapshot: SavedResourceEntry[] = emptyEntries;
let recentSnapshot: SavedResourceEntry[] = emptyEntries;
let bookmarksRaw: string | null | undefined;
let recentRaw: string | null | undefined;

function readBookmarks() {
  const raw = window.localStorage.getItem(bookmarkStorageKey);
  if (raw !== bookmarksRaw) {
    bookmarksRaw = raw;
    bookmarksSnapshot = loadBookmarks();
  }
  return bookmarksSnapshot;
}

function readRecent() {
  const raw = window.localStorage.getItem(recentStorageKey);
  if (raw !== recentRaw) {
    recentRaw = raw;
    recentSnapshot = loadRecentlyViewed();
  }
  return recentSnapshot;
}

function subscribeToLocalChanges(onChange: () => void) {
  const handleChange = () => {
    onChange();
  };

  window.addEventListener("storage", handleChange);
  window.addEventListener(savedResourcesChangeEvent, handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(savedResourcesChangeEvent, handleChange);
  };
}

export function SavedResources() {
  const bookmarks = useSyncExternalStore(
    subscribeToLocalChanges,
    readBookmarks,
    () => emptyEntries
  );
  const recent = useSyncExternalStore(subscribeToLocalChanges, readRecent, () => emptyEntries);
  const [announcement, setAnnouncement] = useState("");

  return (
    <div className="space-y-5">
      <p aria-live="polite" className="sr-only" role="status">
        {announcement}
      </p>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bookmark aria-hidden="true" className="h-5 w-5 text-teal-700" />
            <h2 className="text-base font-semibold text-slate-950">Bookmarks</h2>
          </div>
          <Button
            disabled={bookmarks.length === 0}
            onClick={() => {
              clearBookmarks();
              notifySavedResourcesChanged();
              setAnnouncement("All local bookmarks cleared.");
            }}
            type="button"
            variant="secondary"
          >
            <Trash2 aria-hidden="true" className="h-4 w-4" />
            Clear bookmarks
          </Button>
        </CardHeader>
        <CardBody>
          {bookmarks.length === 0 ? (
            <EmptyState
              description="Save a resource from its detail page to keep a short local list."
              title="No bookmarks yet"
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {bookmarks.map((entry) => (
                <SavedResourceRow
                  entry={entry}
                  key={entry.id}
                  onRemove={() => {
                    removeBookmark(entry.id);
                    notifySavedResourcesChanged();
                    setAnnouncement(`${entry.name} removed from bookmarks.`);
                  }}
                />
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock aria-hidden="true" className="h-5 w-5 text-teal-700" />
            <h2 className="text-base font-semibold text-slate-950">Recently viewed</h2>
          </div>
          <Button
            disabled={recent.length === 0}
            onClick={() => {
              clearRecentlyViewed();
              notifySavedResourcesChanged();
              setAnnouncement("Recently viewed history cleared.");
            }}
            type="button"
            variant="secondary"
          >
            <Trash2 aria-hidden="true" className="h-4 w-4" />
            Clear history
          </Button>
        </CardHeader>
        <CardBody>
          {recent.length === 0 ? (
            <EmptyState
              description="Resources you inspect are listed here for quick return visits."
              title="No recent resources"
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {recent.map((entry) => (
                <SavedResourceRow
                  entry={entry}
                  key={entry.id}
                  onRemove={() => {
                    removeRecentlyViewed(entry.id);
                    notifySavedResourcesChanged();
                    setAnnouncement(`${entry.name} removed from recent history.`);
                  }}
                />
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <p className="text-xs leading-5 text-slate-500">
        Bookmarks and history are stored in this browser profile only. They are not synced, attached
        to a wallet, or persisted server-side. A removed resource still links to its detail page,
        which reports it as unavailable.
      </p>
    </div>
  );
}

function SavedResourceRow({
  entry,
  onRemove
}: {
  entry: SavedResourceEntry;
  onRemove: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <Link
        className="min-h-10 min-w-0 break-all py-2 text-sm font-medium text-teal-800 underline"
        href={`/resources/${entry.id}`}
      >
        {entry.name}
      </Link>
      <Button
        aria-label={`Remove ${entry.name}`}
        className="shrink-0"
        onClick={onRemove}
        type="button"
        variant="ghost"
      >
        <X aria-hidden="true" className="h-4 w-4" />
        Remove
      </Button>
    </li>
  );
}
