"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";

import {
  loadThemePreference,
  resetThemePreference,
  resolveTheme,
  saveThemePreference,
  subscribeSystemContrast,
  subscribeThemePreference,
  systemPrefersHighContrast,
  type ResolvedTheme,
  type ThemePreference
} from "@/services/theme";

type ThemeContextValue = {
  preference: ThemePreference;
  reset: () => void;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Applies the accessibility theme to the document root.
 *
 * The preference is persisted locally, while the effective theme is exposed as
 * `data-theme` so shared component and data-visualisation tokens can react
 * without JavaScript-specific styling.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const preference = useSyncExternalStore(
    subscribeThemePreference,
    loadThemePreference,
    () => "system" as const
  );
  const prefersHighContrast = useSyncExternalStore(
    subscribeSystemContrast,
    systemPrefersHighContrast,
    () => false
  );

  const resolved = resolveTheme(preference, prefersHighContrast);

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved === "high-contrast" ? "dark" : "light";
  }, [resolved]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      reset: () => resetThemePreference(),
      resolved,
      setPreference: (next) => saveThemePreference(next)
    }),
    [preference, resolved]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }

  return context;
}
