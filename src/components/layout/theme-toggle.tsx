"use client";

import { Contrast } from "lucide-react";

import { useTheme } from "@/components/layout/theme-provider";
import { themePreferenceOptions, type ThemePreference } from "@/services/theme";

/**
 * Manual theme selection. `system` keeps following the operating-system
 * contrast preference; an explicit option overrides it until reset.
 */
export function ThemeToggle() {
  const { preference, resolved, setPreference } = useTheme();

  return (
    <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
      <Contrast aria-hidden="true" className="h-4 w-4" />
      <span className="sr-only">Visual theme</span>
      <select
        aria-label="Visual theme"
        className="min-h-8 bg-transparent text-sm text-slate-900"
        onChange={(event) => setPreference(event.target.value as ThemePreference)}
        value={preference}
      >
        {themePreferenceOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="sr-only" role="status">
        {resolved === "high-contrast"
          ? "High contrast theme applied."
          : "Default contrast theme applied."}
      </span>
    </label>
  );
}
