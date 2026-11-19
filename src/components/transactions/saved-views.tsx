"use client";

import { BookmarkPlus, Play, Trash2 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import {
  deleteSavedView,
  getEmptySavedViewsSnapshot,
  getSavedViewsSnapshot,
  saveSavedView,
  subscribeSavedViews,
  type TransactionFilters
} from "@/services/transaction-filters";

export function SavedViews({
  filters,
  onApply
}: {
  filters: TransactionFilters;
  onApply: (filters: TransactionFilters) => void;
}) {
  const views = useSyncExternalStore(
    subscribeSavedViews,
    getSavedViewsSnapshot,
    getEmptySavedViewsSnapshot
  );
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();

  const handleSave = () => {
    try {
      saveSavedView(name, filters);
      setName("");
      setError(undefined);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save this view.");
    }
  };

  const handleDelete = (id: string) => {
    deleteSavedView(id);
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-semibold text-slate-950">Saved views</h2>
        <p className="mt-1 text-sm text-slate-600">
          Stored in this browser. Views keep filters only and restart at the first page.
        </p>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex-1 space-y-1 text-sm">
            <span className="font-medium text-slate-700">View name</span>
            <input
              className="min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-slate-950"
              maxLength={60}
              onChange={(event) => setName(event.target.value)}
              placeholder="Example: Testnet failures"
              value={name}
            />
          </label>
          <Button onClick={handleSave} type="button" variant="secondary">
            <BookmarkPlus aria-hidden="true" className="h-4 w-4" />
            Save current filters
          </Button>
        </div>

        {error ? (
          <p className="text-sm font-medium text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        {views.length === 0 ? (
          <p className="text-sm text-slate-600">No saved views yet.</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {views.map((view) => (
              <li className="flex flex-wrap items-center justify-between gap-2 py-2" key={view.id}>
                <div>
                  <p className="text-sm font-medium text-slate-900">{view.name}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(view.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    aria-label={`Apply saved view ${view.name}`}
                    onClick={() => onApply(view.filters)}
                    type="button"
                    variant="secondary"
                  >
                    <Play aria-hidden="true" className="h-4 w-4" />
                    Apply
                  </Button>
                  <Button
                    aria-label={`Delete saved view ${view.name}`}
                    onClick={() => handleDelete(view.id)}
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
