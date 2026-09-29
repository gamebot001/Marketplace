"use client";

/**
 * THE marketplace chrome — one header and one footer for every route,
 * homepage included. Replaces the previous split system (homepage
 * reference nav + inner-page SiteHeader) with a single implementation.
 *
 * Header states:
 *   01 default            — quiet bar, amber active underline
 *   02 collections hover  — slim preview panel under the nav
 *   03 search             — centered command panel overlay
 *   04 wallet open        — centered connect overlay (WalletButton)
 *   05 scrolled          — darker surface with stable control geometry
 *
 * Navigation honesty: the Collections trigger is a real link to
 * /collections (hover only previews, never intercepts); the homepage
 * never shows "Stats" as active.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ChevronRight,
  Clock,
  Flame,
  LayoutGrid,
  Menu,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { WalletButton } from "@/components/wallet/wallet-button";
import { SearchResults } from "@/components/search-results";
import { NotificationsPopover } from "@/components/notifications-popover";
import { OverlayPortal, useDialogFocus } from "@/components/ui/overlay-portal";
import { ANNOUNCEMENTS } from "@/lib/announcements";

const NAV_LINKS = [
  { href: "/explore", label: "Explore" },
  { href: "/collections", label: "Collections", panel: true },
  { href: "/create", label: "Creators" },
  { href: "/activity", label: "Activity" },
  { href: "/#stats", label: "Stats" },
] as const;

const COLLECTIONS_MENU = [
  {
    href: "/collections",
    icon: LayoutGrid,
    label: "All Collections",
    sub: "Every registered project",
  },
  {
    href: "/#collections",
    icon: Sparkles,
    label: "Featured",
    sub: "Flagship spotlight",
  },
  {
    href: "/explore",
    icon: Flame,
    label: "Trending",
    sub: "Live listings across the market",
  },
  {
    href: "/collections",
    icon: Clock,
    label: "New Arrivals",
    sub: "Freshly listed on the feed",
  },
];

export function MarketplaceHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  /* Search — a centered command overlay, opened from the header field.
     Clicking the field itself never navigates. */
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(searchOpen, searchDialogRef, searchInputRef);

  /* Header-local visibility; the page/hero is a sibling in the root layout.
     The panel's DOM lives in the shared root overlay host. */
  const [notifOpen, setNotifOpen] = useState(false);
  const [bellEl, setBellEl] = useState<HTMLButtonElement | null>(null);
  const closeNotif = useCallback(() => setNotifOpen(false), []);

  /* Unread bell state — the bell only carries product announcements, so the
     dot tracks the latest announcement id and clears once seen this session.
     No trading activity, no fabricated counters. */
  const [seenAnn, setSeenAnn] = useState<string | null>(null);
  useEffect(() => {
    try {
      setSeenAnn(window.sessionStorage.getItem("mk-notif-seen"));
    } catch {
      /* storage unavailable — bell simply shows as read */
    }
  }, []);
  const latestAnn = ANNOUNCEMENTS[0]?.id ?? null;
  const unread = latestAnn != null && latestAnn !== seenAnn;
  const markSeen = useCallback(() => {
    if (!latestAnn) return;
    setSeenAnn(latestAnn);
    try {
      window.sessionStorage.setItem("mk-notif-seen", latestAnn);
    } catch {
      /* ignore */
    }
  }, [latestAnn]);
  const toggleNotif = useCallback(() => {
    setNotifOpen((v) => !v);
    markSeen();
  }, [markSeen]);

  /* Collections hover panel (small close delay bridges the gap). */
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const collectionsTimer = useRef<number | null>(null);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setQuery("");
  }, []);

  const submitSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = query.trim();
      router.push(
        trimmed ? `/explore?q=${encodeURIComponent(trimmed)}` : "/explore"
      );
      setQuery("");
      setSearchOpen(false);
    },
    [query, router]
  );

  const openCollections = useCallback(() => {
    if (collectionsTimer.current != null) {
      window.clearTimeout(collectionsTimer.current);
      collectionsTimer.current = null;
    }
    setCollectionsOpen(true);
  }, []);

  const scheduleCollectionsClose = useCallback(() => {
    if (collectionsTimer.current != null)
      window.clearTimeout(collectionsTimer.current);
    collectionsTimer.current = window.setTimeout(() => {
      setCollectionsOpen(false);
      collectionsTimer.current = null;
    }, 140);
  }, []);

  /* Header scroll state — rAF-throttled, boolean only. */
  useEffect(() => {
    let raf = 0;
    let queued = false;
    const update = () => {
      queued = false;
      setScrolled(window.scrollY > 8);
    };
    const onScroll = () => {
      if (queued) return;
      queued = true;
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  /* ⌘K / Ctrl+K opens search; ESC closes every overlay. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setNotifOpen(false);
        setSearchOpen((v) => !v);
      }
      if (e.key === "Escape") {
        closeSearch();
        setNotifOpen(false);
        setCollectionsOpen(false);
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeSearch]);

  useEffect(
    () => () => {
      if (collectionsTimer.current != null)
        window.clearTimeout(collectionsTimer.current);
    },
    []
  );

  /* Route changes close any open header overlay. */
  useEffect(() => {
    closeSearch();
    setNotifOpen(false);
    setCollectionsOpen(false);
    setMenuOpen(false);
  }, [pathname, closeSearch]);

  /* The homepage shows no active nav item — in particular Stats is never
     selected just because pathname === "/". */
  const isActive = (href: string) => {
    if (href === "/#stats") return false;
    if (pathname === "/") return false;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      <header className="mk-header" data-scrolled={scrolled || undefined}>
        <div className="mk-header-inner">
        <Link
          href="/"
          className="mk-brand"
          aria-label="Zecians Marketplace home"
        >
          <span>ZECIANS</span>
          <em>MARKETPLACE</em>
        </Link>

        <div className="mk-navcenter">
          <nav className="mk-nav" aria-label="Primary">
            {NAV_LINKS.map((item) =>
              "panel" in item && item.panel ? (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  aria-haspopup="true"
                  aria-expanded={collectionsOpen}
                  onMouseEnter={openCollections}
                  onMouseLeave={scheduleCollectionsClose}
                  onFocus={openCollections}
                  onBlur={scheduleCollectionsClose}
                >
                  {item.label}
                </Link>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                >
                  {item.label}
                </Link>
              )
            )}
          </nav>

          {collectionsOpen && (
            <div
              className="mk-navpanel"
              onMouseEnter={openCollections}
              onMouseLeave={scheduleCollectionsClose}
            >
              {COLLECTIONS_MENU.map(({ href, icon: Icon, label, sub }) => (
                <Link
                  key={label}
                  href={href}
                  className="mk-navpanel-item"
                  onFocus={openCollections}
                  onBlur={scheduleCollectionsClose}
                >
                  <span className="mk-navpanel-icon">
                    <Icon size={15} strokeWidth={1.8} aria-hidden />
                  </span>
                  <span className="mk-navpanel-text">
                    <span className="mk-navpanel-label">{label}</span>
                    <span className="mk-navpanel-sub">{sub}</span>
                  </span>
                  <span className="mk-navpanel-arrow" aria-hidden>
                    <ChevronRight size={13} strokeWidth={2} />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="mk-navright">
          <button
            type="button"
            className="mk-search"
            onClick={openSearch}
            aria-label="Search the marketplace"
            aria-expanded={searchOpen}
            aria-haspopup="dialog"
          >
            <Search size={16} strokeWidth={2.2} aria-hidden />
            <span>Search NFTs, collections or creators…</span>
            <kbd>⌘K</kbd>
          </button>

          <WalletButton presentation="compact" />

          <div className="mk-notifwrap">
            <button
              type="button"
              ref={setBellEl}
              className="mk-iconbtn"
              onClick={toggleNotif}
              aria-label={
                unread ? "Announcements — new updates" : "Announcements"
              }
              aria-expanded={notifOpen}
              aria-haspopup="dialog"
              data-open={notifOpen || undefined}
            >
              <Bell size={17} strokeWidth={2} aria-hidden />
              {unread && <span className="mk-belldot" aria-hidden />}
            </button>
          </div>

          <button
            type="button"
            className="mk-iconbtn mk-menu-btn"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? (
              <X size={15} strokeWidth={2} aria-hidden />
            ) : (
              <Menu size={15} strokeWidth={2} aria-hidden />
            )}
          </button>
        </div>
      </div>

      </header>

      {/* Each overlay is outside the page shell in the root portal host. */}
      {notifOpen && bellEl && (
        <NotificationsPopover anchor={bellEl} onClose={closeNotif} />
      )}

      <OverlayPortal>
      {menuOpen && (
        <div className="mk-drawer">
          <form onSubmit={submitSearch} role="search" className="mk-drawer-search">
            <Search size={14} strokeWidth={2.2} aria-hidden />
            <input
              type="search"
              className="mk-searchinput"
              placeholder="Search the marketplace"
              aria-label="Search the marketplace"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </form>
          {NAV_LINKS.map((item) => (
            <Link key={item.href} href={item.href} className="mk-drawer-link">
              {item.label}
              <ChevronRight size={14} aria-hidden />
            </Link>
          ))}
          <div className="mk-drawer-secondary">
            <Link href="/profile">Profile</Link>
            <Link href="/settings">Settings</Link>
            <Link href="/about">About</Link>
          </div>
        </div>
      )}

      {/* Backdrop click closes; ESC closes; ⌘K toggles; submit → /explore. */}
      {searchOpen && (
        <div
          className="mk-cmd-overlay"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeSearch();
          }}
        >
          <div
            className="mk-cmd"
            ref={searchDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Search the marketplace"
            tabIndex={-1}
          >
            <div className="mk-cmd-head">
              <Search size={17} strokeWidth={2.2} aria-hidden />
              <form
                className="mk-cmd-form"
                role="search"
                onSubmit={submitSearch}
              >
                <input
                  ref={searchInputRef}
                  className="mk-cmd-input"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search NFTs, collections or creators..."
                  aria-label="Search the marketplace"
                />
              </form>
              <kbd className="mk-cmd-esc" aria-hidden>
                ESC
              </kbd>
            </div>
            <div className="mk-cmd-body">
              <SearchResults query={query} />
            </div>
          </div>
        </div>
      )}
      </OverlayPortal>
    </>
  );
}

const rd = (i: number) => ({ "--rd": i } as React.CSSProperties);

export function MarketplaceFooter() {
  const footerRef = useRef<HTMLElement>(null);

  /* Soft reveal — one IntersectionObserver adds a class once. */
  useEffect(() => {
    const root = footerRef.current;
    if (!root) return;
    const items = Array.from(
      root.querySelectorAll<HTMLElement>("[data-reveal]")
    );
    if (typeof IntersectionObserver === "undefined") {
      items.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.05 }
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <footer className="mk-footer" ref={footerRef}>
      <span className="mk-footer-light" aria-hidden />
      <span className="mk-footer-rim" aria-hidden />
      <span
        className="mk-footer-signature"
        data-reveal
        style={rd(0)}
        aria-hidden
      >
        <span className="mk-footer-wordmark">ZECIANS</span>
      </span>
      <div className="mk-footer-inner">
        <div className="mk-footer-brand" data-reveal style={rd(0)}>
          <Link
            href="/"
            className="mk-brand"
            aria-label="Zecians Marketplace home"
          >
            <span>ZECIANS</span>
            <em>MARKETPLACE</em>
          </Link>
          <p>
            Discover, collect and trade verified digital collections on
            Solana — real listings, transparent fees, on-chain settlement.
          </p>
        </div>

        <nav
          className="mk-footer-col"
          aria-label="Marketplace"
          data-reveal
          style={rd(1)}
        >
          <h3>Marketplace</h3>
          <ul>
            <li>
              <Link href="/explore">Explore</Link>
            </li>
            <li>
              <Link href="/collections">Collections</Link>
            </li>
            <li>
              <Link href="/activity">Activity</Link>
            </li>
          </ul>
        </nav>

        <nav
          className="mk-footer-col"
          aria-label="Platform"
          data-reveal
          style={rd(2)}
        >
          <h3>Platform</h3>
          <ul>
            <li>
              <Link href="/create">Creators</Link>
            </li>
            <li>
              <Link href="/profile">Profile</Link>
            </li>
            <li>
              <Link href="/settings">Settings</Link>
            </li>
            <li>
              <Link href="/about">About</Link>
            </li>
          </ul>
        </nav>

        <nav
          className="mk-footer-col"
          aria-label="Legal"
          data-reveal
          style={rd(3)}
        >
          <h3>Legal</h3>
          <ul>
            <li>
              <Link href="/terms">Terms</Link>
            </li>
            <li>
              <Link href="/privacy">Privacy</Link>
            </li>
            <li>
              <Link href="/settings#network">Network &amp; fees</Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="mk-footer-bottom" data-reveal style={rd(4)}>
        <span>© Zecians Marketplace</span>
        <span>No token. No allocation promises.</span>
      </div>
    </footer>
  );
}
