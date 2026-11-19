import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UNSAVED_CHANGES_MESSAGE, useUnsavedChangesGuard } from "./use-unsaved-changes";

function Harness({ dirty }: { dirty: boolean }) {
  useUnsavedChangesGuard(dirty);

  return <a href="/seller/payments">Payments</a>;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useUnsavedChangesGuard", () => {
  it("does not warn when the form has no meaningful changes", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<Harness dirty={false} />);

    const navigated = fireEvent.click(screen.getByRole("link", { name: "Payments" }));

    expect(navigated).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("warns on browser navigation only while dirty", () => {
    const { rerender } = render(<Harness dirty={false} />);
    const clean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);

    rerender(<Harness dirty />);
    const dirty = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });

  it("blocks in-app navigation when the seller declines to leave", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<Harness dirty />);

    const navigated = fireEvent.click(screen.getByRole("link", { name: "Payments" }));

    expect(navigated).toBe(false);
    expect(window.confirm).toHaveBeenCalledWith(UNSAVED_CHANGES_MESSAGE);
  });

  it("allows in-app navigation when the seller confirms leaving", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<Harness dirty />);

    expect(fireEvent.click(screen.getByRole("link", { name: "Payments" }))).toBe(true);
  });

  it("removes every listener when the form becomes clean or unmounts", () => {
    const addWindow = vi.spyOn(window, "addEventListener");
    const removeWindow = vi.spyOn(window, "removeEventListener");
    const addDocument = vi.spyOn(document, "addEventListener");
    const removeDocument = vi.spyOn(document, "removeEventListener");

    const { rerender, unmount } = render(<Harness dirty />);

    expect(addWindow).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    expect(addDocument).toHaveBeenCalledWith("click", expect.any(Function), true);

    rerender(<Harness dirty={false} />);

    expect(removeWindow).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    expect(removeDocument).toHaveBeenCalledWith("click", expect.any(Function), true);

    rerender(<Harness dirty />);
    unmount();

    const beforeUnloadAdds = addWindow.mock.calls.filter(([name]) => name === "beforeunload");
    const beforeUnloadRemoves = removeWindow.mock.calls.filter(([name]) => name === "beforeunload");

    expect(beforeUnloadRemoves.length).toBe(beforeUnloadAdds.length);
  });
});
