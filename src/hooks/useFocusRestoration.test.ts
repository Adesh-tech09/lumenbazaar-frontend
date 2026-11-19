import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFocusRestoration } from "./useFocusRestoration";

describe("useFocusRestoration", () => {
  let container: HTMLDivElement;
  let trigger: HTMLButtonElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);

    trigger = document.createElement("button");
    trigger.textContent = "Open Modal";
    container.appendChild(trigger);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("marks trigger element for focus restoration", () => {
    const { result } = renderHook(() => useFocusRestoration(true));

    act(() => {
      result.current.markFocusTrigger(trigger);
    });

    // Verify the hook is tracking the trigger
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
  });

  it("restores focus to trigger element", () => {
    const { result } = renderHook(() => useFocusRestoration(true));

    act(() => {
      result.current.markFocusTrigger(trigger);
    });

    // Focus something else
    const other = document.createElement("input");
    container.appendChild(other);
    other.focus();
    expect(document.activeElement).not.toBe(trigger);

    // Restore focus
    act(() => {
      result.current.restoreFocus();
    });

    expect(document.activeElement).toBe(trigger);
  });

  it("does not restore focus if trigger is removed from DOM", () => {
    const { result } = renderHook(() => useFocusRestoration(true));

    act(() => {
      result.current.markFocusTrigger(trigger);
    });

    // Remove trigger from DOM
    container.removeChild(trigger);

    const h1 = document.createElement("h1");
    container.appendChild(h1);

    // Should not focus the removed trigger
    act(() => {
      result.current.restoreFocus();
    });

    expect(document.activeElement).not.toBe(trigger);
  });

  it("calls onFocusRestored callback when focus is restored", () => {
    let callbackCalled = false;
    const { result } = renderHook(() =>
      useFocusRestoration(true, () => {
        callbackCalled = true;
      })
    );

    act(() => {
      result.current.markFocusTrigger(trigger);
    });

    // Focus something else
    const other = document.createElement("input");
    container.appendChild(other);
    other.focus();

    // Restore focus
    act(() => {
      result.current.restoreFocus();
    });

    expect(callbackCalled).toBe(true);
  });

  it("does not call onFocusRestored if element not in DOM", () => {
    let callbackCalled = false;
    const { result } = renderHook(() =>
      useFocusRestoration(true, () => {
        callbackCalled = true;
      })
    );

    act(() => {
      result.current.markFocusTrigger(trigger);
    });

    // Remove trigger
    container.removeChild(trigger);

    // Try to restore focus
    act(() => {
      result.current.restoreFocus();
    });

    expect(callbackCalled).toBe(false);
  });

  it("handles nested overlays by tracking separate triggers", () => {
    const outerTrigger = trigger;
    const innerTrigger = document.createElement("button");
    innerTrigger.textContent = "Open Inner Modal";
    container.appendChild(innerTrigger);

    const { result: outerHook } = renderHook(() => useFocusRestoration(true));
    const { result: innerHook } = renderHook(() => useFocusRestoration(true));

    // Mark outer trigger
    act(() => {
      outerHook.current.markFocusTrigger(outerTrigger);
    });

    // Mark inner trigger
    act(() => {
      innerHook.current.markFocusTrigger(innerTrigger);
    });

    // Simulate inner modal close
    act(() => {
      innerHook.current.restoreFocus();
    });
    expect(document.activeElement).toBe(innerTrigger);

    // Simulate outer modal close
    act(() => {
      outerHook.current.restoreFocus();
    });
    expect(document.activeElement).toBe(outerTrigger);
  });

  it("gracefully handles null trigger", () => {
    const { result } = renderHook(() => useFocusRestoration(true));

    act(() => {
      result.current.markFocusTrigger(null);
    });

    // Should not error
    act(() => {
      result.current.restoreFocus();
    });

    expect(true).toBe(true); // No error thrown
  });
});
