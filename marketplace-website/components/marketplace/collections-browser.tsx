"use client";

/**
 * Collections — the collection directory.
 *
 * A premium marketplace index with one row-based table carrying the identity
 * cluster (PFP + name + verification), favourite control, navigation, metrics
 * and sort order. A unified search / verified / sort control sits above, and
 * the table headers themselves sort by floor, volume and sales. Honest empty &
 * error states throughout.
 *
 * Every metric supports a secondary 24h change, drawn only from real data: a
 * metric without a reported change shows "—" until the backend populates it.
 * Owners render as "—" until a real holder count exists.
 *
 * No per-frame layout reads and no pointer-driven state: row reveal is a CSS
 * animation driven by a static inline --i, and every hover response is
 * transform/opacity/border CSS, so the page cannot flicker. Row highlighting is
 * :hover-driven only — focus cannot leave a row stuck in an active state.
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  Layers,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useCollections, useListings } from "@/lib/api/hooks";
import { Artwork } from "@/components/ui/artwork";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { SortSelect, type SortOption } from "@/components/ui/sort-select";
import { WatchToggle } from "@/components/marketplace/watchlist";
import { resolveImageUrl, formatSol } from "@/lib/format";
import {
  DEMO_MODE,
  demoCollectionMedia,
  demoCollectionStats,
  type DemoCollectionStats,
} from "@/lib/demo-marketplace-data";
import type { MarketplaceCollection } from "@/lib/api/types";

type SortKey =
  | "name-asc"
  | "name-desc"
  | "floor-asc"
  | "floor-desc"
  | "volume-asc"
  | "volume-desc"
  | "sales-asc"
  | "sales-desc";

type MetricPrefix = "floor" | "volume" | "sales";
type SortState = "none" | "asc" | "desc";

interface MetricChanges {
  floor: number | null;
  volume: number | null;
  sales: number | null;
  listed: number | null;
}

interface CollectionView {
  collection: MarketplaceCollection;
  stats: DemoCollectionStats | null;
  live: number;
  changes: MetricChanges;
}

/**
 * Map the backend's real collection roll-up onto the presentation stats shape.
 * Null floor renders as "—"; no percentage change is invented (all deltas are
 * null until the backend actually tracks them).
 */
function apiCollectionStats(
  collection: MarketplaceCollection
): DemoCollectionStats | null {
  const stats = collection.stats;
  if (!stats) return null;
  return {
    // A null floor means "no active listing", which must render "—", not 0 SOL.
    floorLamports: stats.floor_lamports ?? null,
    volumeLamports: stats.volume_lamports ?? 0,
    change24hPercent: 0,
    supply: stats.supply,
    listedCount: stats.listed_count,
    sales24h: stats.sales,
    floorChange24hPercent: stats.floor_change_24h,
    volumeChange24hPercent: stats.volume_change_24h,
    salesChange24hPercent: stats.sales_change_24h,
    listedChange24hPercent: stats.listed_change_24h,
  };
}

/**
 * Secondary 24h change for one metric. Renders the real value when present and
 * a faint em dash when it is not — never an invented percentage.
 */
function MetricChange({ value, title }: { value: number | null; title: string }) {
  if (value == null) {
    return (
      <span className="coll-row-change coll-row-change-empty" aria-hidden>
        —
      </span>
    );
  }
  const up = value >= 0;
  return (
    <span className="coll-row-change" data-change={up ? "up" : "down"} title={title}>
      {up ? (
        <ArrowUpRight size={12} aria-hidden />
      ) : (
        <ArrowDownRight size={12} aria-hidden />
      )}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

/** Numeric comparison that always keeps missing values at the bottom. */
function compareValues(
  a: number | null | undefined,
  b: number | null | undefined,
  dir: 1 | -1
): number {
  const av = a ?? null;
  const bv = b ?? null;
  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;
  return dir * (av - bv);
}

function compare(a: CollectionView, b: CollectionView, key: SortKey): number {
  switch (key) {
    case "name-desc":
      return b.collection.name.localeCompare(a.collection.name);
    case "floor-asc":
      return compareValues(a.stats?.floorLamports, b.stats?.floorLamports, 1);
    case "floor-desc":
      return compareValues(a.stats?.floorLamports, b.stats?.floorLamports, -1);
    case "volume-asc":
      return compareValues(a.stats?.volumeLamports, b.stats?.volumeLamports, 1);
    case "volume-desc":
      return compareValues(a.stats?.volumeLamports, b.stats?.volumeLamports, -1);
    case "sales-asc":
      return compareValues(a.stats?.sales24h, b.stats?.sales24h, 1);
    case "sales-desc":
      return compareValues(a.stats?.sales24h, b.stats?.sales24h, -1);
    default:
      return a.collection.name.localeCompare(b.collection.name);
  }
}

function metricState(sortKey: SortKey, metric: MetricPrefix): SortState {
  if (sortKey === (`${metric}-asc` as SortKey)) return "asc";
  if (sortKey === (`${metric}-desc` as SortKey)) return "desc";
  return "none";
}

/** neutral → ascending → descending → neutral (back to the default name sort) */
function cycleMetric(sortKey: SortKey, metric: MetricPrefix): SortKey {
  const state = metricState(sortKey, metric);
  if (state === "none") return `${metric}-asc` as SortKey;
  if (state === "asc") return `${metric}-desc` as SortKey;
  return "name-asc";
}

function SortHeader({
  label,
  metric,
  sortKey,
  onSort,
  title,
}: {
  label: string;
  metric: MetricPrefix;
  sortKey: SortKey;
  onSort: (key: SortKey) => void;
  title?: string;
}) {
  const state = metricState(sortKey, metric);
  return (
    <button
      type="button"
      className="coll-sort-btn"
      data-state={state}
      aria-label={`Sort by ${label}`}
      title={title}
      onClick={() => onSort(cycleMetric(sortKey, metric))}
    >
      <span>{label}</span>
      {state === "asc" ? (
        <ChevronUp size={12} aria-hidden />
      ) : state === "desc" ? (
        <ChevronDown size={12} aria-hidden />
      ) : (
        <ChevronsUpDown size={12} aria-hidden />
      )}
    </button>
  );
}

function CollectionRow({
  view,
  index,
}: {
  view: CollectionView;
  index: number;
}) {
  const { collection, stats, live, changes } = view;
  const verified = collection.verification_status === "verified";
  const pfp = resolveImageUrl(collection.image);
  const number = String(index + 1).padStart(2, "0");
  const address = collection.collection_address;
  const owners = collection.owners ?? collection.stats?.owners ?? null;

  return (
    <div
      className="coll-row"
      style={{ "--i": String(Math.min(index, 12)) } as CSSProperties}
    >
      <Link
        href={`/collections/${collection.slug}`}
        className="coll-row-hit"
        aria-label={`View ${collection.name}`}
      />

      <span className="coll-row-num" aria-hidden>
        {number}
      </span>

      <span className="coll-row-fav-slot">
        {address ? (
          <WatchToggle
            assetAddress={address}
            label={collection.name}
            className="coll-row-fav"
            size={15}
          />
        ) : (
          <span className="coll-row-fav-empty" aria-hidden />
        )}
      </span>

      <span className="coll-row-pfp">
        <Artwork src={pfp} alt="" sizes="48px" />
      </span>

      <span className="coll-row-name">
        <span className="nm">{collection.name}</span>
        {verified && (
          <BadgeCheck size={15} aria-label="Verified" className="coll-row-check" />
        )}
      </span>

      <span className="coll-row-stats">
        <span className="coll-row-stat" data-rank="1">
          <span className="coll-row-k">Floor</span>
          <span className="coll-row-v">
            {stats ? formatSol(stats.floorLamports) : "—"}
          </span>
          {stats && (
            <MetricChange
              value={changes.floor}
              title="Floor change in the last 24 hours"
            />
          )}
        </span>
        <span className="coll-row-stat" data-rank="2">
          <span className="coll-row-k">24H Volume</span>
          <span className="coll-row-v">
            {stats ? formatSol(stats.volumeLamports) : "—"}
          </span>
          {stats && (
            <MetricChange
              value={changes.volume}
              title="Volume change in the last 24 hours"
            />
          )}
        </span>
        <span className="coll-row-stat" data-rank="3">
          <span className="coll-row-k">24H Sales</span>
          <span className="coll-row-v">
            {stats ? stats.sales24h.toLocaleString("en-US") : "—"}
          </span>
          {stats && (
            <MetricChange
              value={changes.sales}
              title="Sales change in the last 24 hours"
            />
          )}
        </span>
        <span className="coll-row-stat coll-row-listed" data-rank="4">
          <span className="coll-row-k">Listed</span>
          <span className="coll-row-v">
            {live > 0 ? live.toLocaleString("en-US") : "—"}
          </span>
          {live > 0 && (
            <MetricChange
              value={changes.listed}
              title="Listings change in the last 24 hours"
            />
          )}
        </span>
        <span className="coll-row-stat" data-rank="5">
          <span className="coll-row-k">Owners</span>
          <span className="coll-row-v">
            {owners != null && owners > 0
              ? owners.toLocaleString("en-US")
              : "—"}
          </span>
        </span>
      </span>

      <span className="coll-row-arrow" aria-hidden>
        <ChevronRight size={17} />
      </span>
    </div>
  );
}

/**
 * Shortest wrapped ring distance from the active index to a collection index,
 * in the range (-count/2, count/2].
 */
function wrapOffset(index: number, active: number, count: number): number {
  let d = ((index - active) % count + count) % count;
  if (d > count / 2) d -= count;
  return d;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* Continuous piecewise-linear layout for the tight cluster: a card's wrapped
   ring offset maps to lateral travel, Z recession, Y turn, scale and
   brightness. Every card keeps the same centre line — there is no Y motion —
   and depth comes from X, Z, rotateY and a dim overlay child, never a filter. */
const DECK_KEY = [
  { x: 0, z: 0, ry: 0, s: 1.0, br: 1.0 },
  { x: 200, z: -55, ry: 18, s: 0.86, br: 0.85 },
  { x: 345, z: -125, ry: 24, s: 0.72, br: 0.68 },
  { x: 450, z: -190, ry: 30, s: 0.58, br: 0.5 },
  { x: 535, z: -245, ry: 34, s: 0.46, br: 0.32 },
];

function layoutTight(o: number) {
  const s = Math.sign(o) || 1;
  const a = Math.abs(o);
  if (a >= 4) {
    const k = DECK_KEY[4];
    return { x: s * k.x, z: k.z, ry: s * k.ry, s: k.s, br: k.br };
  }
  const i = Math.floor(a);
  const f = a - i;
  const k1 = DECK_KEY[i];
  const k2 = DECK_KEY[i + 1];
  return {
    x: s * (k1.x + (k2.x - k1.x) * f),
    z: k1.z + (k2.z - k1.z) * f,
    ry: s * (k1.ry + (k2.ry - k1.ry) * f),
    s: k1.s + (k2.s - k1.s) * f,
    br: k1.br + (k2.br - k1.br) * f,
  };
}

const DECK_SLOT_PX = 180;
const DECK_FLING_VELOCITY = 0.5;
const DECK_WHEEL_SLOT_PX = 200;
const DECK_SNAP_FACTOR = 0.28;
const DECK_DWELL_MS = 6500;

/**
 * Featured collections as a "depth deck" — a tight, dense cluster of full
 * collection cards. Every card is mounted once and carries its complete
 * content (PFP, name, verification, floor, 24h volume, CTA); depth is expressed
 * by scale, Z recession, a Y turn and a dim overlay child — never a CSS filter.
 * Transforms are written every frame by JS (rAF): the trackpad writes the ring
 * directly for a 1:1 follow, while arrows, drag release and the dwell timer ask
 * for an eased snap that the rAF loop pulls toward with an ease-out factor.
 *
 * Interaction: click-hold + drag moves the deck 1:1 with the cursor over an
 * unlimited distance, the arrows step one slot, a dominantly horizontal
 * trackpad gesture follows the finger and snaps after idle, and ← / → apply to
 * the hovered stage. Clicking any card — including the receding slivers — shows
 * a quiet routing toast and navigates to the collection.
 */
function CollectionsShowcase({ views }: { views: CollectionView[] }) {
  const router = useRouter();
  const featured = useMemo(
    () =>
      [...views]
        .sort((a, b) => {
          const flag =
            Number(Boolean(b.collection.flagship)) -
            Number(Boolean(a.collection.flagship));
          if (flag !== 0) return flag;
          return a.collection.name.localeCompare(b.collection.name);
        })
        .slice(0, 22),
    [views]
  );

  const count = featured.length;

  const stageRef = useRef<HTMLDivElement | null>(null);
  const glowRef = useRef<HTMLDivElement | null>(null);
  const countRef = useRef<HTMLElement | null>(null);
  const nextRef = useRef<HTMLButtonElement | null>(null);
  const prevRef = useRef<HTMLButtonElement | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dimRefs = useRef<(HTMLDivElement | null)[]>([]);
  const insideRef = useRef(false);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || count === 0) return;

    const stageEl: HTMLDivElement = stage;
    const cards = cardRefs.current.slice(0, count);
    const dims = dimRefs.current.slice(0, count);
    const lastDim: number[] = [];
    const countEl = countRef.current;
    const glowEl = glowRef.current;

    const ring = { current: 0 };
    const state: {
      hovered: number;
      dragging: boolean;
      dragMoved: boolean;
      suppressClickUntil: number;
      raf: number;
      running: boolean;
      snapTarget: number | null;
    } = {
      hovered: -1,
      dragging: false,
      dragMoved: false,
      suppressClickUntil: 0,
      raf: 0,
      running: false,
      snapTarget: null,
    };
    const drag = { startX: 0, startActive: 0, lastX: 0, lastT: 0, velocity: 0 };
    const wheel = { base: null as number | null, acc: 0, timer: 0 };
    let dwellTimer = 0;

    const updateCount = () => {
      if (!countEl) return;
      const idx = ((Math.round(ring.current) % count) + count) % count;
      countEl.textContent = String(idx + 1).padStart(2, "0");
    };

    /* Write-only render: reads no layout, touches no React state. */
    const render = () => {
      const rounded = Math.round(ring.current);
      let centerX = 0;
      for (let i = 0; i < cards.length; i += 1) {
        const el = cards[i];
        if (!el) continue;
        const oF = wrapOffset(i, ring.current, count);
        const aF = Math.abs(oF);
        const aR = Math.abs(wrapOffset(i, rounded, count));
        const isActive = aR < 0.5;
        const g = layoutTight(oF);

        el.style.transform = `translate3d(${g.x.toFixed(2)}px, 0px, ${g.z.toFixed(
          2
        )}px) rotateY(${g.ry.toFixed(2)}deg) scale(${g.s.toFixed(3)})`;
        el.dataset.role = isActive ? "active" : aF < 1.5 ? "side" : "far";
        el.style.zIndex = String(Math.round(200 - aF * 30));

        const dim = dims[i];
        if (dim) {
          const dimOpacity = isActive ? 0 : Math.min(0.62, 1 - g.br);
          if (lastDim[i] !== dimOpacity) {
            dim.style.opacity = dimOpacity.toFixed(3);
            lastDim[i] = dimOpacity;
          }
        }

        if (isActive) centerX = g.x;
      }
      if (glowEl) {
        glowEl.style.transform = `translateX(calc(-50% + ${centerX.toFixed(
          1
        )}px))`;
      }
    };

    /* rAF snap — pulls ring.current toward state.snapTarget with an ease-out
       factor. Runs ONLY while an explicit snapTarget exists (arrows / trackpad
       release / drag release / dwell); trackpad movement writes directly. */
    const tick = () => {
      if (state.dragging || state.snapTarget === null) {
        state.running = false;
        return;
      }
      const diff = state.snapTarget - ring.current;
      if (Math.abs(diff) < 0.0012) {
        ring.current = state.snapTarget;
        state.snapTarget = null;
        updateCount();
        render();
        state.running = false;
        return;
      }
      ring.current += diff * DECK_SNAP_FACTOR;
      updateCount();
      render();
      state.raf = requestAnimationFrame(tick);
    };

    const wake = () => {
      if (state.running) return;
      state.running = true;
      state.raf = requestAnimationFrame(tick);
    };

    const snapTo = (target: number) => {
      state.snapTarget = target;
      wake();
    };

    const pauseDwell = () => {
      clearTimeout(dwellTimer);
    };

    const resetDwell = () => {
      clearTimeout(dwellTimer);
      if (count <= 1) return;
      dwellTimer = window.setTimeout(() => {
        snapTo(Math.round(ring.current) + 1);
        resetDwell();
      }, DECK_DWELL_MS);
    };

    const arrowStep = (dir: -1 | 1) => {
      pauseDwell();
      const from = state.snapTarget !== null ? state.snapTarget : ring.current;
      snapTo(Math.round(from) + dir);
      resetDwell();
    };

    /* CARD CLICK — pointer capture retargets the click to the stage, so the hit
       is resolved from the point via elementFromPoint; any card, including the
       back-card slivers, resolves to its own .coll-deck-card. */
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target && target.closest(".coll-deck-chrome")) return;
      if (performance.now() < state.suppressClickUntil) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || !el.closest) return;
      const cardEl = el.closest(".coll-deck-card") as HTMLElement | null;
      if (!cardEl) return;
      const idx = Number(cardEl.dataset.i);
      const view = featured[idx];
      const slug = cardEl.dataset.slug ?? view?.collection.slug;
      if (!slug) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) {
        window.open(`/collections/${slug}`, "_blank");
      } else {
        router.push(`/collections/${slug}`);
      }
    };

    /* POINTER DRAG — 1:1 unlimited. */
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const target = e.target as Element | null;
      if (target && target.closest(".coll-deck-chrome")) return;
      if (count <= 1) return;

      pauseDwell();
      state.dragging = true;
      state.dragMoved = false;
      state.snapTarget = null;
      drag.startX = e.clientX;
      drag.startActive = ring.current;
      drag.lastX = e.clientX;
      drag.lastT = performance.now();
      drag.velocity = 0;
      stageEl.classList.add("is-dragging");
      try {
        stageEl.setPointerCapture(e.pointerId);
      } catch {
        /* capture is best-effort */
      }
    };

    const onMove = (e: PointerEvent) => {
      if (!state.dragging) return;
      const now = performance.now();
      const dt = Math.max(1, now - drag.lastT);
      const dx = e.clientX - drag.lastX;
      drag.velocity = lerp(drag.velocity, dx / dt, 0.35);
      drag.lastX = e.clientX;
      drag.lastT = now;

      const totalDx = e.clientX - drag.startX;
      if (Math.abs(totalDx) > 6) state.dragMoved = true;

      ring.current = drag.startActive - totalDx / DECK_SLOT_PX;
      updateCount();
      render();
    };

    const onUp = (e: PointerEvent) => {
      if (!state.dragging) return;
      state.dragging = false;
      stageEl.classList.remove("is-dragging");
      try {
        stageEl.releasePointerCapture(e.pointerId);
      } catch {
        /* capture is best-effort */
      }

      if (!state.dragMoved) {
        resetDwell();
        return;
      }

      state.suppressClickUntil = performance.now() + 200;
      window.setTimeout(() => {
        state.dragMoved = false;
      }, 220);

      const flung = Math.abs(drag.velocity) > DECK_FLING_VELOCITY;
      const base = Math.round(ring.current);
      snapTo(flung ? base + (drag.velocity < 0 ? 1 : -1) : base);
      resetDwell();
    };

    /* TRACKPAD — smooth follow. Direct 1:1 write (no rAF); the gesture's base
       is anchored on its first event and the deck snaps to the nearest slot
       100ms after the last event. Vertical motion always belongs to the page. */
    const onWheel = (e: WheelEvent) => {
      if (count <= 1) return;
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) * 1.15) return;
      if (Math.abs(e.deltaX) < 0.5) return;
      e.preventDefault();
      pauseDwell();

      state.snapTarget = null;
      state.running = false;

      if (wheel.base === null) wheel.base = ring.current;
      wheel.acc += e.deltaX;
      ring.current = wheel.base - wheel.acc / DECK_WHEEL_SLOT_PX;
      updateCount();
      render();

      clearTimeout(wheel.timer);
      wheel.timer = window.setTimeout(() => {
        snapTo(Math.round(ring.current));
        wheel.base = null;
        wheel.acc = 0;
        resetDwell();
      }, 100);
    };

    const onEnter = () => {
      insideRef.current = true;
      pauseDwell();
    };
    const onLeave = () => {
      insideRef.current = false;
      pauseDwell();
      resetDwell();
    };

    const onKey = (e: KeyboardEvent) => {
      if (!insideRef.current) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        arrowStep(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        arrowStep(-1);
      }
    };

    const hoverHandlers = cards.map((el, i) => {
      if (!el) return () => {};
      const enter = () => {
        state.hovered = i;
        el.classList.add("is-hovered");
      };
      const leave = () => {
        if (state.hovered === i) state.hovered = -1;
        el.classList.remove("is-hovered");
      };
      el.addEventListener("pointerenter", enter);
      el.addEventListener("pointerleave", leave);
      return () => {
        el.removeEventListener("pointerenter", enter);
        el.removeEventListener("pointerleave", leave);
      };
    });

    const bindArrow = (
      btn: HTMLButtonElement | null,
      dir: -1 | 1
    ): (() => void) => {
      if (!btn) return () => {};
      const down = (e: PointerEvent) => {
        e.stopPropagation();
        e.preventDefault();
      };
      const click = (e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        arrowStep(dir);
      };
      btn.addEventListener("pointerdown", down, { passive: false });
      btn.addEventListener("click", click);
      return () => {
        btn.removeEventListener("pointerdown", down);
        btn.removeEventListener("click", click);
      };
    };

    const unbindNext = bindArrow(nextRef.current, 1);
    const unbindPrev = bindArrow(prevRef.current, -1);

    stageEl.addEventListener("pointerdown", onDown);
    stageEl.addEventListener("pointermove", onMove);
    stageEl.addEventListener("pointerup", onUp);
    stageEl.addEventListener("pointercancel", onUp);
    stageEl.addEventListener("wheel", onWheel, { passive: false });
    stageEl.addEventListener("click", onClick);
    stageEl.addEventListener("mouseenter", onEnter);
    stageEl.addEventListener("mouseleave", onLeave);
    window.addEventListener("keydown", onKey);

    updateCount();
    render();
    resetDwell();

    return () => {
      cancelAnimationFrame(state.raf);
      clearTimeout(dwellTimer);
      clearTimeout(wheel.timer);
      state.running = false;
      stageEl.removeEventListener("pointerdown", onDown);
      stageEl.removeEventListener("pointermove", onMove);
      stageEl.removeEventListener("pointerup", onUp);
      stageEl.removeEventListener("pointercancel", onUp);
      stageEl.removeEventListener("wheel", onWheel);
      stageEl.removeEventListener("click", onClick);
      stageEl.removeEventListener("mouseenter", onEnter);
      stageEl.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("keydown", onKey);
      hoverHandlers.forEach((fn) => fn());
      unbindNext();
      unbindPrev();
    };
  }, [count, featured, router]);

  if (count === 0) return null;

  return (
    <section className="coll-deck" aria-label="Featured collections">
      <div
        className="coll-deck-stage"
        ref={stageRef}
        role="group"
        aria-roledescription="carousel"
        onDragStart={(e) => e.preventDefault()}
      >
        <div className="coll-deck-chrome">
          <span className="coll-deck-label">
            <span className="coll-deck-eyebrow">Featured</span>
            <span className="coll-deck-count">
              <b ref={countRef}>01</b> / <span>{count}</span>
            </span>
          </span>
          {count > 1 && (
            <div className="coll-deck-arrows">
              <button
                type="button"
                className="coll-deck-arrow"
                ref={prevRef}
                aria-label="Previous featured collections"
              >
                <ChevronLeft size={17} aria-hidden />
              </button>
              <button
                type="button"
                className="coll-deck-arrow"
                ref={nextRef}
                aria-label="Next featured collections"
              >
                <ChevronRight size={17} aria-hidden />
              </button>
            </div>
          )}
        </div>

        <div className="coll-deck-glow" ref={glowRef} aria-hidden />

        <div className="coll-deck-track">
          {featured.map((view, i) => {
            const { collection, stats } = view;
            const verified = collection.verification_status === "verified";
            const media = demoCollectionMedia(collection.slug);
            const pfp = media?.pfp ?? resolveImageUrl(collection.image);
            return (
              <div
                key={collection.slug}
                className="coll-deck-card"
                data-i={i}
                data-slug={collection.slug}
                ref={(el) => {
                  cardRefs.current[i] = el;
                }}
              >
                <div
                  className="coll-deck-dim"
                  ref={(el) => {
                    dimRefs.current[i] = el;
                  }}
                />
                <div className="coll-deck-pfp">
                  <Artwork src={pfp} alt="" sizes="200px" />
                </div>
                <div className="coll-deck-name-row">
                  <span className="coll-deck-name">{collection.name}</span>
                  {verified && (
                    <BadgeCheck
                      size={15}
                      aria-label="Verified"
                      className="coll-deck-verify"
                    />
                  )}
                </div>
                <div className="coll-deck-extra">
                  <div className="coll-deck-rule" />
                  <div className="coll-deck-stats">
                    <div className="coll-deck-stat">
                      <span className="coll-deck-k">Floor</span>
                      <span className="coll-deck-v">
                        {stats ? formatSol(stats.floorLamports) : "—"}
                      </span>
                    </div>
                    <div className="coll-deck-stat">
                      <span className="coll-deck-k">24H Vol</span>
                      <span className="coll-deck-v">
                        {stats ? formatSol(stats.volumeLamports) : "—"}
                      </span>
                    </div>
                  </div>
                  <div className="coll-deck-cta">
                    View collection <ArrowRight size={12} aria-hidden />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function DirectorySkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="coll-list" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="coll-row coll-row-skeleton">
          <span className="skeleton coll-sk-num" />
          <span className="skeleton coll-sk-fav" />
          <span className="skeleton coll-sk-pfp" />
          <span className="skeleton coll-sk-name" />
          <span className="coll-row-stats">
            <span className="skeleton coll-sk-stat" />
            <span className="skeleton coll-sk-stat" />
            <span className="skeleton coll-sk-stat" />
            <span className="skeleton coll-sk-stat" />
            <span className="skeleton coll-sk-stat" />
          </span>
          <span className="skeleton coll-sk-arrow" />
        </div>
      ))}
    </div>
  );
}

export function CollectionsBrowser() {
  const { data, error, loading } = useCollections();
  const listings = useListings({ status: "active" });

  const collections = useMemo(() => data ?? [], [data]);

  const [query, setQuery] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("name-asc");

  const liveByAddress = useMemo(() => {
    const map = new Map<string, number>();
    for (const listing of listings.data ?? []) {
      const key = listing.collection_address ?? "";
      if (key) map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [listings.data]);

  const views = useMemo<CollectionView[]>(
    () =>
      collections.map((collection) => {
        const stats = DEMO_MODE
          ? demoCollectionStats(collection.slug)
          : apiCollectionStats(collection);
        return {
          collection,
          stats,
          live: collection.collection_address
            ? (liveByAddress.get(collection.collection_address) ?? 0)
            : 0,
          changes: {
            floor:
              stats?.floorChange24hPercent ??
              collection.floor_change_24h ??
              null,
            volume:
              stats?.volumeChange24hPercent ??
              collection.volume_change_24h ??
              null,
            sales:
              stats?.salesChange24hPercent ??
              collection.sales_change_24h ??
              null,
            listed:
              stats?.listedChange24hPercent ??
              collection.listed_change_24h ??
              null,
          },
        };
      }),
    [collections, liveByAddress]
  );

  const hasStats = useMemo(() => views.some((v) => v.stats), [views]);
  const hasSales = useMemo(
    () => views.some((v) => v.stats?.sales24h != null),
    [views]
  );

  const sortOptions = useMemo<SortOption<SortKey>[]>(() => {
    const options: SortOption<SortKey>[] = [
      { value: "name-asc", label: "Name: A–Z" },
      { value: "name-desc", label: "Name: Z–A" },
    ];
    if (hasStats) {
      options.push(
        { value: "floor-desc", label: "Floor: high to low" },
        { value: "floor-asc", label: "Floor: low to high" },
        { value: "volume-desc", label: "24H Volume: high to low" },
        { value: "volume-asc", label: "24H Volume: low to high" }
      );
    }
    if (hasSales) {
      options.push(
        { value: "sales-desc", label: "24H Sales: high to low" },
        { value: "sales-asc", label: "24H Sales: low to high" }
      );
    }
    return options;
  }, [hasStats, hasSales]);

  const normalizedQuery = query.trim().toLowerCase();
  const hasFilters = normalizedQuery.length > 0 || verifiedOnly;

  const filtered = useMemo(() => {
    const list = views.filter(({ collection }) => {
      if (verifiedOnly && collection.verification_status !== "verified") {
        return false;
      }
      if (!normalizedQuery) return true;
      // Collection search matches the visible NAME and SLUG only. Description,
      // standard, addresses and other hidden fields must never enter the
      // haystack — searching "d" must not surface unrelated collections.
      const haystack = [collection.name, collection.slug]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
    return [...list].sort((a, b) => compare(a, b, sort));
  }, [views, normalizedQuery, verifiedOnly, sort]);

  if (loading) {
    return (
      <div className="coll-browser">
        <DirectorySkeleton count={6} />
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Could not load collections" message={error} />;
  }

  if (collections.length === 0) {
    return (
      <EmptyState
        icon={<Layers size={18} />}
        title="No verified collections yet"
        message="Verified projects registered on the Zecians platform will appear here. Collection onboarding is opening soon."
        action={
          <Link href="/create" className="btn btn-outline btn-sm">
            Bring your collection
          </Link>
        }
      />
    );
  }

  return (
    <div className="coll-browser">
      <CollectionsShowcase views={views} />

      <div className="control-row coll-controls" role="search">
        <label className="mkt-search">
          <Search size={15} aria-hidden />
          <input
            type="search"
            placeholder="Search collections"
            aria-label="Search collections"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        <div className="coll-controls-end">
          <button
            type="button"
            className="mkt-control"
            aria-pressed={verifiedOnly}
            onClick={() => setVerifiedOnly((v) => !v)}
          >
            <BadgeCheck size={14} aria-hidden />
            Verified
          </button>

          <SortSelect<SortKey>
            value={sort}
            options={sortOptions}
            onChange={setSort}
            ariaLabel="Sort collections"
          />
        </div>
      </div>

      {hasFilters && (
        <div className="coll-results">
          <span className="coll-results-count">
            {filtered.length} result{filtered.length === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            className="coll-clear"
            onClick={() => {
              setQuery("");
              setVerifiedOnly(false);
            }}
          >
            Clear
          </button>
        </div>
      )}

      {filtered.length > 0 ? (
        <div className="coll-list">
          <div className="coll-list-head">
              <span className="coll-list-head-name">Collection</span>
              <span className="coll-list-head-stats">
                {hasStats ? (
                  <SortHeader
                    label="Floor"
                    metric="floor"
                    sortKey={sort}
                    onSort={setSort}
                  />
                ) : (
                  <span>Floor</span>
                )}
                {hasStats ? (
                  <SortHeader
                    label="24H Volume"
                    metric="volume"
                    sortKey={sort}
                    onSort={setSort}
                  />
                ) : (
                  <span>24H Volume</span>
                )}
                {hasSales ? (
                  <SortHeader
                    label="24H Sales"
                    metric="sales"
                    sortKey={sort}
                    onSort={setSort}
                    title="Sales in the last 24 hours"
                  />
                ) : (
                  <span title="Sales in the last 24 hours">24H Sales</span>
                )}
                <span>Listed</span>
                <span>Owners</span>
              </span>
            </div>
          {filtered.map((view, i) => (
            <CollectionRow key={view.collection.slug} view={view} index={i} />
          ))}
        </div>
      ) : hasFilters ? (
        <EmptyState
          icon={<SlidersHorizontal size={18} />}
          title="Nothing matches"
          message="No collections match the current search. Try a different name or clear the filters."
        />
      ) : null}
    </div>
  );
}
