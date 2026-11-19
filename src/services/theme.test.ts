import { describe, expect, it } from "vitest";

import {
  loadThemePreference,
  resetThemePreference,
  resolveTheme,
  saveThemePreference,
  themePreferenceStorageKey
} from "./theme";

class MockStorage {
  private data = new Map<string, string>();

  getItem(key: string) {
    return this.data.get(key) ?? null;
  }

  removeItem(key: string) {
    this.data.delete(key);
  }

  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

describe("theme preference", () => {
  it("follows the system contrast preference when set to system", () => {
    expect(resolveTheme("system", true)).toBe("high-contrast");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("lets an explicit manual choice override the system preference", () => {
    expect(resolveTheme("high-contrast", false)).toBe("high-contrast");
    expect(resolveTheme("light", true)).toBe("light");
  });

  it("persists and reloads the preference", () => {
    const storage = new MockStorage();

    saveThemePreference("high-contrast", storage);

    expect(storage.getItem(themePreferenceStorageKey)).toBe("high-contrast");
    expect(loadThemePreference(storage)).toBe("high-contrast");
  });

  it("falls back to system for unknown stored values", () => {
    const storage = new MockStorage();
    storage.setItem(themePreferenceStorageKey, "neon");

    expect(loadThemePreference(storage)).toBe("system");
  });

  it("resets to the system preference", () => {
    const storage = new MockStorage();
    saveThemePreference("light", storage);

    expect(resetThemePreference(storage)).toBe("system");
    expect(storage.getItem(themePreferenceStorageKey)).toBeNull();
    expect(loadThemePreference(storage)).toBe("system");
  });
});
