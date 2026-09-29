"use client";

/**
 * Announcement center — product announcements ONLY.
 *
 * This is deliberately NOT an activity feed. Trading events (sold / bought /
 * listed / transfer) are market data and live on /activity and the collection
 * pages; the bell only ever surfaces product-level statements about the
 * marketplace itself (see lib/announcements.ts). Rows are clean, vertical and
 * static — never fabricated, never derived from the chain.
 *
 * Positioning: the panel hangs directly below the notification bell, RIGHT
 * aligned to it, clamped inside the viewport, with a small caret pointing back
 * at the bell. Recomputed on resize/scroll only (no per-frame layout reads).
 *
 * The panel is rendered through the root overlay host, outside the sticky
 * header and page shell, so its state and placement stay isolated from the
 * homepage environment.
 *
 * ANTI-FLICKER: no backdrop-filter, entrance animates opacity/transform only,
 * and the panel is compositor-promoted (see the overlay compositing rules in
 * marketplace-chrome.css).
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import Link from "next/link";
import { ArrowUpRight, Megaphone } from "lucide-react";
import { ANNOUNCEMENTS } from "@/lib/announcements";
import { OverlayPortal } from "@/components/ui/overlay-portal";

const PANEL_WIDTH = 368;

export function NotificationsPopover({
  anchor,
  onClose,
}: {
  anchor: HTMLElement;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    caret: number;
  } | null>(null);

  /* Bell-anchored placement — compact vertical panel tucked just under the
     header, right-aligned to the bell so it opens on the RIGHT. */
  const place = useCallback(() => {
    const rect = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const width = Math.min(PANEL_WIDTH, vw - 32);
    const left = Math.max(
      16,
      Math.min(Math.round(rect.right - width), vw - width - 16)
    );
    const header = anchor.closest(".mk-header");
    const headerBottom = header
      ? header.getBoundingClientRect().bottom
      : rect.bottom + 24;
    const top = Math.round(Math.max(headerBottom + 10, rect.bottom + 10));
    const caret = Math.round(
      Math.min(width - 30, Math.max(14, rect.left + rect.width / 2 - left - 5))
    );
    setPos((prev) =>
      prev && prev.top === top && prev.left === left && prev.caret === caret
        ? prev
        : { top, left, caret }
    );
  }, [anchor]);

  useLayoutEffect(() => {
    place();
  }, [place]);

  useEffect(() => {
    let raf = 0;
    const queue = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        place();
      });
    };
    window.addEventListener("resize", queue);
    window.addEventListener("scroll", queue, { passive: true });
    return () => {
      window.removeEventListener("resize", queue);
      window.removeEventListener("scroll", queue);
      cancelAnimationFrame(raf);
    };
  }, [place]);

  /* Outside click closes; clicks on the panel and the bell itself do not. */
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchor.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [anchor, onClose]);

  return (
    <OverlayPortal>
      <div
        ref={panelRef}
        className="mk-notif"
        role="dialog"
        aria-label="Announcements"
        style={
          pos
            ? ({
                top: pos.top,
                left: pos.left,
                "--notif-top": `${pos.top}px`,
                "--notif-caret": `${pos.caret}px`,
              } as CSSProperties)
            : undefined
        }
        data-ready={pos ? "" : undefined}
      >
        <div className="mk-notif-head">
          <span>
            Announcements
            <em className="mk-notif-headnote">product updates</em>
          </span>
        </div>

        {/* Clean vertical rows — announcements only. */}
        <div className="mk-notif-list" role="list">
          {ANNOUNCEMENTS.map((a) => {
            const body = (
              <>
                <span className="mk-notif-rowicon" aria-hidden>
                  <Megaphone size={15} strokeWidth={2} />
                </span>
                <span className="mk-notif-rowbody">
                  <span className="mk-notif-rowtop">
                    <b className="mk-notif-tag">{a.tag}</b>
                    <span className="mk-notif-rowtime">Update</span>
                  </span>
                  <span className="mk-notif-rowtitle">{a.title}</span>
                  <span className="mk-notif-rowtext">{a.body}</span>
                </span>
                {a.href && (
                  <ArrowUpRight
                    className="mk-notif-rowarrow"
                    size={14}
                    strokeWidth={2}
                    aria-hidden
                  />
                )}
              </>
            );
            return a.href ? (
              <Link
                key={a.id}
                href={a.href}
                role="listitem"
                className="mk-notif-row"
              >
                {body}
              </Link>
            ) : (
              <div key={a.id} role="listitem" className="mk-notif-row">
                {body}
              </div>
            );
          })}

          {ANNOUNCEMENTS.length === 0 && (
            <p className="mk-notif-empty">No announcements yet</p>
          )}
        </div>
      </div>
    </OverlayPortal>
  );
}
