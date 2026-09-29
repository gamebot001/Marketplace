"use client";

import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

/** A persistent host outside the page shell and its animated descendants. */
export function OverlayPortal({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHost(document.getElementById("marketplace-overlays"));
  }, []);

  return host ? createPortal(children, host) : null;
}

/**
 * Watches the shared overlay host and flags the document while any portal
 * overlay is mounted. This lets the page freeze its animated environment and
 * suspend the hero carousel underneath an open overlay — an always-animating
 * 3D stage behind a translucent scrim was the overlay-swipe flicker.
 */
export function OverlayHostSentinel() {
  useEffect(() => {
    const host = document.getElementById("marketplace-overlays");
    if (!host) return;
    const root = document.documentElement;
    const sync = () => {
      if (host.childElementCount > 0) root.setAttribute("data-overlay-open", "");
      else root.removeAttribute("data-overlay-open");
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(host, { childList: true });
    return () => {
      observer.disconnect();
      root.removeAttribute("data-overlay-open");
    };
  }, []);

  return null;
}

/** Keep keyboard focus in the portal without scrolling the underlying page. */
export function useDialogFocus(
  open: boolean,
  dialogRef: RefObject<HTMLElement>,
  initialFocusRef?: RefObject<HTMLElement>
) {
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const previous = document.activeElement;
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'a[href], button:enabled, input:enabled, select:enabled, textarea:enabled, [tabindex="0"]'
    ));
    (initialFocusRef?.current ?? focusable()[0] ?? dialog).focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0] ?? dialog;
      const last = elements[elements.length - 1] ?? dialog;
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!e.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    };
    dialog.addEventListener("keydown", onKey);
    return () => {
      dialog.removeEventListener("keydown", onKey);
      if (previous instanceof HTMLElement && previous.isConnected) {
        previous.focus({ preventScroll: true });
      }
    };
  }, [open, dialogRef, initialFocusRef]);
}
