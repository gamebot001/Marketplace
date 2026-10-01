"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Moon, Sun } from "lucide-react";
import type { CollectionDetailData } from "@/lib/collection-detail-data";
import { shorten } from "@/lib/format";
import { c } from "./collection-detail.styles";
import { Verify } from "./icons";

export type CollectionTab = "nfts" | "activity" | "about";

const TABS: { key: CollectionTab; label: string }[] = [
  { key: "nfts", label: "NFTs" },
  { key: "activity", label: "Activity" },
  { key: "about", label: "About" },
];

export function CollectionHeader({
  data,
  activeTab,
  nftCount,
  theme,
  onTabChange,
  onToggleTheme,
  onCopyCreator,
}: {
  data: CollectionDetailData;
  activeTab: CollectionTab;
  nftCount: number;
  theme: "dark" | "light";
  onTabChange: (tab: CollectionTab) => void;
  onToggleTheme: () => void;
  onCopyCreator: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const pfpRef = useRef<HTMLDivElement | null>(null);

  /* Cursor parallax on the PFP — smooth lerp, transform only, and skipped
     entirely for reduced-motion users. */
  useEffect(() => {
    const wrap = wrapRef.current;
    const pfp = pfpRef.current;
    if (!wrap || !pfp) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let px = 0;
    let py = 0;
    let tx = 0;
    let ty = 0;
    let raf = 0;
    let running = false;

    const tick = () => {
      px += (tx - px) * 0.12;
      py += (ty - py) * 0.12;
      pfp.style.transform = `translate3d(${(px * 5).toFixed(2)}px, ${(
        py * 5
      ).toFixed(2)}px, 0) rotateX(${(-py * 4).toFixed(2)}deg) rotateY(${(
        px * 5
      ).toFixed(2)}deg)`;
      if (Math.abs(px - tx) + Math.abs(py - ty) > 0.001) {
        raf = requestAnimationFrame(tick);
      } else {
        running = false;
      }
    };

    const onMove = (event: MouseEvent) => {
      const rect = wrap.getBoundingClientRect();
      tx = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      ty = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };
    const onLeave = () => {
      tx = 0;
      ty = 0;
      if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };

    wrap.addEventListener("mousemove", onMove);
    wrap.addEventListener("mouseleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      wrap.removeEventListener("mousemove", onMove);
      wrap.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <>
      <div className={c("rhead")}>
        <div className={c("rheadRow")}>
          <div className={c("crumb")}>
            <Link href="/collections">Collection</Link>
          </div>
          <button
            type="button"
            className={c("themeToggle")}
            aria-label="Toggle theme"
            onClick={onToggleTheme}
          >
            <Sun className={c("icon-sun")} aria-hidden />
            <Moon className={c("icon-moon")} aria-hidden />
          </button>
        </div>
        <h1 className={c("name")}>
          {data.name}
          {data.verified ? <Verify className={c("verify")} /> : null}
        </h1>
      </div>

      <aside className={c("rbody")}>
        <div className={c("pfpWrap")} ref={wrapRef}>
          <div className={c("pfp")} ref={pfpRef}>
            {data.pfp ? <img src={data.pfp} alt={data.name} draggable={false} /> : null}
          </div>
        </div>

        <p className={c("desc")}>{data.description}</p>

        <div className={c("creator")}>
          Creator · <b>{shorten(data.creator, 5, 4)}</b>
          <button
            type="button"
            aria-label="Copy creator address"
            onClick={onCopyCreator}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
        </div>

        <div className={c("stats")}>
          <div className={c("stat")}>
            <span className={c("k")}>Floor</span>
            <span className={c("v")}>
              {data.floor}
              <small>SOL</small>
            </span>
          </div>
          <div className={c("stat")}>
            <span className={c("k")}>Volume</span>
            <span className={c("v")}>
              {data.volume}
              <small>SOL</small>
            </span>
          </div>
          <div className={c("stat")}>
            <span className={c("k")}>Items</span>
            <span className={c("v")}>{data.totalItems}</span>
          </div>
          <div className={c("stat")}>
            <span className={c("k")}>Listed</span>
            <span className={c("v")}>{data.listedCount}</span>
          </div>
        </div>

        <nav className={c("tabs")}>
          {TABS.map((tab) => (
            <button
              type="button"
              key={tab.key}
              className={c("tab", tab.key === activeTab && "on")}
              aria-current={tab.key === activeTab ? "page" : undefined}
              onClick={() => onTabChange(tab.key)}
            >
              {tab.label}
              {tab.key === "nfts" ? (
                <span className={c("count")}>
                  {nftCount.toLocaleString("en-US")}
                </span>
              ) : null}
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
}
