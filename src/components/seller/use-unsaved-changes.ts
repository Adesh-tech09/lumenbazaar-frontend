"use client";

import { useEffect } from "react";

export const UNSAVED_CHANGES_MESSAGE =
  "You have unsaved changes. Leave this page and discard them?";

/**
 * Warns before meaningful unsaved seller edits are abandoned.
 *
 * Covers browser navigation (reload, tab close, back/forward) through
 * `beforeunload`, and in-app link navigation by intercepting same-tab link
 * clicks. Programmatic router pushes are confirmed by the caller. All
 * listeners are removed when the guard is disabled or unmounted.
 */
export function useUnsavedChangesGuard(isDirty: boolean, message = UNSAVED_CHANGES_MESSAGE) {
  useEffect(() => {
    if (!isDirty) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      // Browsers show their own copy; the return value is required by older ones.
      event.returnValue = message;
      return message;
    }

    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;

      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");

      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target !== "" && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const destination = new URL(anchor.href, window.location.href);

      if (destination.origin !== window.location.origin) return;

      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleClick, true);
    };
  }, [isDirty, message]);
}
