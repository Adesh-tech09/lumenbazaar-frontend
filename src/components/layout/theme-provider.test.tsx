import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { themePreferenceStorageKey } from "@/services/theme";

import { ThemeProvider } from "./theme-provider";
import { ThemeToggle } from "./theme-toggle";

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  vi.unstubAllGlobals();
});

describe("ThemeProvider", () => {
  it("applies the system default theme to the document", async () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("light");
    });
  });

  it("applies and persists a manually selected high-contrast theme", async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    await user.selectOptions(screen.getByLabelText("Visual theme"), "high-contrast");

    expect(document.documentElement.dataset.theme).toBe("high-contrast");
    expect(window.localStorage.getItem(themePreferenceStorageKey)).toBe("high-contrast");
    expect(screen.getByText("High contrast theme applied.")).toBeInTheDocument();
  });

  it("restores a saved preference instead of the system default", async () => {
    window.localStorage.setItem(themePreferenceStorageKey, "high-contrast");

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("high-contrast");
    });
    expect(screen.getByLabelText("Visual theme")).toHaveValue("high-contrast");
  });
});
