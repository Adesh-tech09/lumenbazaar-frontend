import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { isBookmarked } from "@/services/bookmarks";

import { ResourceBookmarkButton } from "./resource-bookmark-button";

beforeEach(() => {
  window.localStorage.clear();
});

describe("ResourceBookmarkButton", () => {
  it("toggles the local bookmark and announces the change", async () => {
    render(<ResourceBookmarkButton name="Paid Weather API" resourceId="resource_weather" />);

    const button = screen.getByRole("button", { name: "Save locally" });
    expect(button).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(button);

    expect(screen.getByRole("button", { name: "Saved locally" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(isBookmarked("resource_weather")).toBe(true);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Paid Weather API saved to local bookmarks."
    );

    await userEvent.click(screen.getByRole("button", { name: "Saved locally" }));
    expect(isBookmarked("resource_weather")).toBe(false);
  });
});
