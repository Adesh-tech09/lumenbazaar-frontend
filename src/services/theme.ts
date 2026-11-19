export const themePreferenceStorageKey = "lumenbazaar.accessibility.theme.v1";

export type ThemePreference = "system" | "light" | "high-contrast";
export type ResolvedTheme = "light" | "high-contrast";

type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export const themePreferenceOptions: ReadonlyArray<{
  label: string;
  value: ThemePreference;
}> = [
  { label: "Match system contrast", value: "system" },
  { label: "Default contrast", value: "light" },
  { label: "High contrast", value: "high-contrast" }
];

/**
 * Resolves a stored preference into the theme applied to the document.
 *
 * `system` follows `prefers-contrast: more`; an explicit choice always wins.
 */
export function resolveTheme(
  preference: ThemePreference,
  systemPrefersHighContrast: boolean
): ResolvedTheme {
  if (preference === "high-contrast") {
    return "high-contrast";
  }

  if (preference === "light") {
    return "light";
  }

  return systemPrefersHighContrast ? "high-contrast" : "light";
}

export function loadThemePreference(
  storage: StorageLike | undefined = browserStorage()
): ThemePreference {
  const raw = storage?.getItem(themePreferenceStorageKey);

  return raw === "light" || raw === "high-contrast" || raw === "system" ? raw : "system";
}

const themePreferenceChangeEvent = "lumenbazaar:theme-preference-change";

export function saveThemePreference(
  preference: ThemePreference,
  storage: StorageLike | undefined = browserStorage()
) {
  storage?.setItem(themePreferenceStorageKey, preference);
  notifyThemePreferenceChange();
  return preference;
}

export function resetThemePreference(storage: StorageLike | undefined = browserStorage()) {
  storage?.removeItem(themePreferenceStorageKey);
  notifyThemePreferenceChange();
  return "system" as const;
}

/** Subscribes to preference changes from this tab and from other tabs. */
export function subscribeThemePreference(listener: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener("storage", listener);
  window.addEventListener(themePreferenceChangeEvent, listener);

  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(themePreferenceChangeEvent, listener);
  };
}

/** Subscribes to operating-system contrast preference changes. */
export function subscribeSystemContrast(listener: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => undefined;
  }

  const query = window.matchMedia("(prefers-contrast: more)");
  query.addEventListener("change", listener);

  return () => query.removeEventListener("change", listener);
}

function notifyThemePreferenceChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(themePreferenceChangeEvent));
  }
}

export function systemPrefersHighContrast(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(prefers-contrast: more)").matches;
}

function browserStorage(): StorageLike | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.localStorage;
}
