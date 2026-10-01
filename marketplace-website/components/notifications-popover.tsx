"use client";

/**
 * Notification center — three honest categories, nothing invented.
 *
 *   Announcements   product-level updates about the marketplace itself.
 *   Market activity real observed events (sales, listings, transfers).
 *   Your activity   only shown when a wallet is connected, and only the
 *                   events that actually involve that address.
 *
 * Trading events are market data, never dressed up as announcements. Every row
 * is clickable through to the shared in-context NFT experience.
 *
 * Positioning: the panel hangs directly below the notification bell, RIGHT
 * aligned to it, clamped inside the viewport, with a caret pointing back at the
 * bell. Recomputed on resize/scroll only (no per-frame layout reads).
 *
 * ANTI-FLICKER: no backdrop-filter, entrance animates opacity/transform only,
 * rendered through the root overlay host.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import Link from "next/link";
import { ArrowUpRight, Megaphone } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { ANNOUNCEMENTS } from "@/lib/announcements";
import { OverlayPortal } from "@/components/ui/overlay-portal";
import {
  activityLabel,
  activityWallet,
} from "@/lib/marketplace/views";
import { buildListingViews } from "@/lib/marketplace/views";
import { useActivity, useListingsWithAssets } from "@/lib/api/hooks";
import { formatSol, relativeTime, shorten } from "@/lib/format";
import { useNftQuickView } from "@/components/marketplace/nft-quick-view";

const PANEL_WIDTH = 380;

type NotifTab = "announcements" | "market" | "mine";

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

  const { publicKey, connected } = useWallet();
  const address = publicKey?.toBase58() ?? null;
  const { open: openNft } = useNftQuickView();
  const activityState = useActivity(60);
  const meta = useListingsWithAssets({ status: null });

  const [tab, setTab] = useState<NotifTab>("announcements");

  const views = useMemo(
    () =>
      meta.data
        ? buildListingViews(meta.data.listings, meta.data.assets, meta.data.collections)
        : [],
    [meta.data]
  );
  const viewByAsset = useMemo(
    () => new Map(views.map((v) => [v.listing.asset_address, v])),
    [views]
  );

  const marketEvents = useMemo(
    () => activityState.data ?? [],
    [activityState.data]
  );
  const myEvents = useMemo(
    () =>
      address
        ? marketEvents.filter((e) => activityWallet(e) === address)
        : [],
    [marketEvents, address]
  );

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

  const tabs: { id: NotifTab; label: string }[] = connected
    ? [
        { id: "announcements", label: "Announcements" },
        { id: "market", label: "Market" },
        { id: "mine", label: "Yours" },
      ]
    : [
        { id: "announcements", label: "Announcements" },
        { id: "market", label: "Market" },
      ];

  const renderEvent = (event: (typeof marketEvents)[number]) => {
    const key = event.signature;
    const view = event.asset_address
      ? viewByAsset.get(event.asset_address)
      : undefined;
    const name =
      view?.name ||
      (event.asset_address ? shorten(event.asset_address, 5, 5) : "Chain event");
    const body = (
      <>
        <span className="mk-notif-rowicon" aria-hidden>
          <span className="mk-notif-eventdot" data-kind={event.type} />
        </span>
        <span className="mk-notif-rowbody">
          <span className="mk-notif-rowtop">
            <b className="mk-notif-tag">{activityLabel(event.type)}</b>
            <span className="mk-notif-rowtime">
              {relativeTime(event.block_time ?? event.now) ?? "—"}
            </span>
          </span>
          <span className="mk-notif-rowtitle">{name}</span>
          <span className="mk-notif-rowtext">
            {event.lamports !== null && event.lamports !== undefined
              ? formatSol(event.lamports)
              : "—"}
            {view?.collectionName ? ` · ${view.collectionName}` : ""}
          </span>
        </span>
        {event.asset_address && (
          <ArrowUpRight className="mk-notif-rowarrow" size={14} strokeWidth={2} aria-hidden />
        )}
      </>
    );

    if (!event.asset_address) {
      return (
        <div key={key} role="listitem" className="mk-notif-row">
          {body}
        </div>
      );
    }
    return (
      <button
        key={key}
        type="button"
        role="listitem"
        className="mk-notif-row"
        onClick={() => {
          onClose();
          openNft({ address: event.asset_address as string, view: view ?? undefined });
        }}
      >
        {body}
      </button>
    );
  };

  return (
    <OverlayPortal>
      <div
        ref={panelRef}
        className="mk-notif"
        role="dialog"
        aria-label="Notifications"
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
          <div className="mk-notif-tabs" role="tablist" aria-label="Notification categories">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className="mk-notif-tab"
                data-active={tab === t.id || undefined}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mk-notif-list" role="list">
          {tab === "announcements" &&
            ANNOUNCEMENTS.map((a) => {
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
                  onClick={onClose}
                >
                  {body}
                </Link>
              ) : (
                <div key={a.id} role="listitem" className="mk-notif-row">
                  {body}
                </div>
              );
            })}

          {tab === "market" &&
            (activityState.loading ? (
              <p className="mk-notif-empty">Loading activity…</p>
            ) : activityState.error ? (
              <p className="mk-notif-empty">{activityState.error}</p>
            ) : marketEvents.length === 0 ? (
              <p className="mk-notif-empty">No market activity yet</p>
            ) : (
              marketEvents.slice(0, 10).map(renderEvent)
            ))}

          {tab === "mine" &&
            (activityState.loading ? (
              <p className="mk-notif-empty">Loading activity…</p>
            ) : myEvents.length === 0 ? (
              <p className="mk-notif-empty">Nothing for your wallet yet</p>
            ) : (
              myEvents.slice(0, 10).map(renderEvent)
            ))}

          {tab === "announcements" && ANNOUNCEMENTS.length === 0 && (
            <p className="mk-notif-empty">No announcements yet</p>
          )}
        </div>
      </div>
    </OverlayPortal>
  );
}
