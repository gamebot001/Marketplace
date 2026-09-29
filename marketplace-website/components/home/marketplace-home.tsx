"use client";

/**
 * Zecians Marketplace homepage — the approved 3D hero followed by the
 * market sections. This component owns NO chrome: the shared header/footer
 * come from components/marketplace-chrome.tsx via the global layout, so the
 * homepage and every inner route wear the same product frame.
 *
 * Flow: hero → featured collections marquee → trending picks → creator
 * feature. Full activity lives on /activity (and per-collection on
 * the collection pages) — never on the homepage.
 *
 * Data arrives fully shaped via props (demo dataset or live API — see
 * app/page.tsx). Sections stay hidden until real data exists; nothing
 * fabricated is ever rendered.
 */

import {
  useEffect,
  useRef,
  type CSSProperties,
} from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { DesignHero } from "@/components/home/design-hero";

export interface HomeStatsCell {
  value: string;
  label: string;
}

export interface HomeCollectionCard {
  name: string;
  image: string | null;
  href: string;
  verified: boolean;
}

export interface HomeNftCard {
  name: string;
  collection: string;
  image: string | null;
  href: string;
  price: string | null;
  status: string | null;
}

export interface HomeCollageItem {
  image: string;
  alt: string;
  href: string | null;
}

export interface MarketplaceHomeData {
  stats: HomeStatsCell[];
  featured: HomeCollectionCard[];
  trending: HomeNftCard[];
  collage: HomeCollageItem[];
}

function CardArt({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return <div className="mk-art-fallback" aria-hidden="true" />;
  }
  return <img src={src} alt={alt} loading="lazy" draggable={false} />;
}

/**
 * "Trending NFTs" — a Centered Showcase.
 *
 * One clean row of artwork-first cards; the card nearest the centre of the
 * viewport carries a subtle amber highlight. Circular side arrows step the
 * rail by exactly one card and a thin hairline tracks the position. It is
 * fully stateless — scrolling, highlighting and the progress bar are direct
 * DOM writes inside a single rAF, so motion can never trigger a re-render, a
 * remount or a page-level repaint.
 */
function TrendingRail({ items }: { items: HomeNftCard[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const prevRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    let raf = 0;

    const update = () => {
      const max = rail.scrollWidth - rail.clientWidth;
      const ratio =
        rail.scrollWidth > 0 ? rail.clientWidth / rail.scrollWidth : 1;

      const fill = fillRef.current;
      if (fill) {
        fill.style.width = `${Math.max(ratio * 100, 14)}%`;
        fill.style.left = `${
          max > 0 ? (rail.scrollLeft / rail.scrollWidth) * 100 : 0
        }%`;
      }

      /* the card whose centre sits closest to the showcase centre */
      const railRect = rail.getBoundingClientRect();
      const anchor = railRect.left + rail.clientWidth / 2;
      const cards = rail.querySelectorAll<HTMLElement>(".mk-rail-card");
      let active: HTMLElement | null = null;
      let best = Infinity;
      cards.forEach((card) => {
        const r = card.getBoundingClientRect();
        const d = Math.abs(r.left + r.width / 2 - anchor);
        if (d < best) {
          best = d;
          active = card;
        }
      });
      cards.forEach((card) =>
        card.classList.toggle("is-active", card === active)
      );

      if (prevRef.current) prevRef.current.disabled = rail.scrollLeft <= 1;
      if (nextRef.current) {
        nextRef.current.disabled = max <= 1 || rail.scrollLeft >= max - 1;
      }
    };

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    rail.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
    return () => {
      rail.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [items.length]);

  const nudge = (dir: number) => {
    const rail = railRef.current;
    if (!rail) return;
    const card = rail.querySelector<HTMLElement>(".mk-rail-card");
    const gap = parseFloat(getComputedStyle(rail).columnGap) || 0;
    const amount = card
      ? card.getBoundingClientRect().width + gap
      : rail.clientWidth;
    rail.scrollBy({ left: dir * amount, behavior: "smooth" });
  };

  return (
    <>
      <div className="mk-trending-stage">
        <button
          type="button"
          ref={prevRef}
          className="mk-rail-nav mk-rail-nav-prev"
          onClick={() => nudge(-1)}
          aria-label="Previous NFTs"
        >
          <ChevronLeft size={18} strokeWidth={1.75} aria-hidden />
        </button>

        <div
          className="mk-rail"
          ref={railRef}
          data-reveal
          role="list"
          aria-label="Trending NFTs"
        >
          {items.map((nft, i) => (
            <Link
              key={nft.href}
              href={nft.href}
              role="listitem"
              className="mk-rail-card"
              style={{ "--i": i } as CSSProperties}
            >
              <span className="mk-rail-art">
                {nft.image ? (
                  <img
                    src={nft.image}
                    alt={nft.name}
                    loading="lazy"
                    draggable={false}
                  />
                ) : (
                  <span className="mk-art-fallback" aria-hidden="true" />
                )}
              </span>
              <span className="mk-rail-body">
                <span className="mk-rail-name">{nft.name}</span>
                <span className="mk-rail-coll">{nft.collection}</span>
                {nft.price && (
                  <span className="mk-rail-price mono">{nft.price}</span>
                )}
              </span>
            </Link>
          ))}
        </div>

        <button
          type="button"
          ref={nextRef}
          className="mk-rail-nav mk-rail-nav-next"
          onClick={() => nudge(1)}
          aria-label="Next NFTs"
        >
          <ChevronRight size={18} strokeWidth={1.75} aria-hidden />
        </button>
      </div>

      <div className="mk-rail-progress" aria-hidden="true">
        <span className="mk-rail-progress-fill" ref={fillRef} />
      </div>
    </>
  );
}

export function MarketplaceHome({ data }: { data: MarketplaceHomeData }) {
  /* Section reveal — one IntersectionObserver adds a class once. */
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = rootRef.current;
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
      { rootMargin: "0px 0px -8% 0px", threshold: 0.06 }
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  /* Creator-stage parallax — rAF-lerped CSS variables, no React state. */
  const stageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let rect: DOMRect | null = null;
    let raf = 0;
    let running = false;
    const cur = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    const AMP = 10;

    const tick = () => {
      cur.x += (target.x - cur.x) * 0.08;
      cur.y += (target.y - cur.y) * 0.08;
      el.style.setProperty("--ppx", `${cur.x.toFixed(2)}px`);
      el.style.setProperty("--ppy", `${cur.y.toFixed(2)}px`);
      if (
        Math.abs(cur.x - target.x) > 0.04 ||
        Math.abs(cur.y - target.y) > 0.04
      ) {
        raf = requestAnimationFrame(tick);
      } else {
        running = false;
      }
    };
    const wake = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(tick);
    };
    const onEnter = () => {
      rect = el.getBoundingClientRect();
    };
    const onMove = (e: globalThis.PointerEvent) => {
      if (!rect) rect = el.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      target.x = nx * AMP * 2;
      target.y = ny * AMP * 2;
      wake();
    };
    const onLeave = () => {
      target.x = 0;
      target.y = 0;
      wake();
    };
    const invalidate = () => {
      rect = null;
    };

    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", invalidate);
    window.addEventListener("scroll", invalidate, { passive: true });
    return () => {
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", invalidate);
      window.removeEventListener("scroll", invalidate);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="mk-home" ref={rootRef}>
      {/* Page environment — a cinematic, always-alive atmosphere built from
          layered light: a deep warm-black wash, broad amber/violet fields,
          slow flowing light ribbons, section light pools, an occasional amber
          sweep, atmospheric haze, drifting dust, grain and a vignette.
          Stable by design: transform/opacity only, no blur filters, no
          per-frame JS, no layout impact. */}
      <div className="mk-env" aria-hidden="true">
        <div className="mk-env-base" />
        <div className="mk-env-field" />
        <div className="mk-env-ribbons">
          <span className="mk-env-ribbon mk-env-ribbon-a" />
          <span className="mk-env-ribbon mk-env-ribbon-b" />
        </div>
        <div className="mk-env-pools">
          <span className="mk-env-pool mk-env-pool-featured" />
          <span className="mk-env-pool mk-env-pool-trending" />
          <span className="mk-env-pool mk-env-pool-creator" />
        </div>
        <div className="mk-env-haze" />
        <div className="mk-env-dust">
          {[
            { left: "8%", top: "18%", size: 2.4, dur: "24s", delay: "-4s", dx: "22px", op: 0.34 },
            { left: "14%", top: "62%", size: 1.5, dur: "31s", delay: "-22s", dx: "16px", op: 0.2 },
            { left: "23%", top: "38%", size: 1.8, dur: "27s", delay: "-18s", dx: "-16px", op: 0.24 },
            { left: "31%", top: "78%", size: 2, dur: "29s", delay: "-14s", dx: "-18px", op: 0.28 },
            { left: "38%", top: "30%", size: 1.4, dur: "33s", delay: "-9s", dx: "14px", op: 0.2 },
            { left: "44%", top: "50%", size: 2.2, dur: "23s", delay: "-8s", dx: "24px", op: 0.3 },
            { left: "52%", top: "70%", size: 1.6, dur: "26s", delay: "-25s", dx: "-14px", op: 0.22 },
            { left: "58%", top: "34%", size: 2.4, dur: "23s", delay: "-6s", dx: "18px", op: 0.32 },
            { left: "66%", top: "58%", size: 1.5, dur: "30s", delay: "-16s", dx: "16px", op: 0.2 },
            { left: "71%", top: "24%", size: 1.5, dur: "28s", delay: "-21s", dx: "-20px", op: 0.22 },
            { left: "78%", top: "72%", size: 2, dur: "27s", delay: "-11s", dx: "-18px", op: 0.26 },
            { left: "82%", top: "44%", size: 2.1, dur: "25s", delay: "-12s", dx: "22px", op: 0.3 },
            { left: "88%", top: "62%", size: 1.4, dur: "32s", delay: "-19s", dx: "14px", op: 0.2 },
            { left: "93%", top: "30%", size: 1.6, dur: "24s", delay: "-7s", dx: "-16px", op: 0.24 },
          ].map((d, i) => (
            <span
              key={i}
              style={
                {
                  left: d.left,
                  top: d.top,
                  width: `${d.size}px`,
                  height: `${d.size}px`,
                  "--ddur": d.dur,
                  "--ddelay": d.delay,
                  "--ddx": d.dx,
                  "--dop": d.op,
                } as CSSProperties
              }
            />
          ))}
        </div>
        <div className="mk-env-grain" />
        <div className="mk-env-vignette" />
      </div>

      {/* Approved hero — identical design-preview implementation, embedded
          in the page flow beneath the shared chrome (variant="home"). */}
      <DesignHero variant="home" />

      {data.featured.length > 0 && (
        <section className="mk-section mk-section-featured" id="collections">
          <div className="mk-container">
            <div className="mk-section-head mk-featured-head" data-reveal>
              <div>
                <span className="mk-kicker">Curated</span>
                <h2>Featured Collections</h2>
                <p>The collections shaping the culture right now.</p>
              </div>
              <Link className="mk-section-link" href="/collections">
                View all <ArrowUpRight size={13} aria-hidden />
              </Link>
            </div>
          </div>

          {/* Continuous identity rail — each set renders the curated list
              three times (comfortably wider than any viewport), so moving
              the two-set track by exactly one set width loops with no blank
              space, no pause and no reset flash. */}
          <div className="mk-container">
            <div className="mk-marquee" data-reveal>
              <div className="mk-marquee-track">
                {[0, 1].map((set) => (
                  <div
                    className="mk-marquee-set"
                    key={set}
                    aria-hidden={set === 1 || undefined}
                  >
                    {[0, 1, 2].flatMap((rep) =>
                      data.featured.map((collection, i) => {
                        const interactive = set === 0 && rep === 0;
                        return (
                          <Link
                            className="mk-featured-item"
                            key={`${set}-${rep}-${collection.href}-${i}`}
                            href={collection.href}
                            tabIndex={interactive ? undefined : -1}
                            aria-hidden={!interactive || undefined}
                          >
                            <span className="mk-featured-pfp">
                              <CardArt
                                src={collection.image}
                                alt={interactive ? `${collection.name} collection PFP` : ""}
                              />
                            </span>
                            <span className="mk-featured-name">
                              {collection.name}
                              {collection.verified && (
                                <BadgeCheck
                                  size={16}
                                  strokeWidth={2.4}
                                  aria-label="Verified collection"
                                />
                              )}
                            </span>
                          </Link>
                        );
                      })
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {data.trending.length > 0 && (
        <section className="mk-section mk-section-trending" id="explore">
          <div className="mk-container">
            <div
              className="mk-section-head mk-trending-head"
              data-reveal
            >
              <div>
                <h2>Trending NFTs</h2>
                <p>What is being discovered across the market right now.</p>
              </div>
              <Link className="mk-section-link mk-trending-viewall" href="/explore">
                View all <ArrowUpRight size={13} aria-hidden />
              </Link>
            </div>

            {/* Centered showcase — one row of artwork-first cards, stepped by
                the circular side arrows with a hairline position indicator. */}
            <TrendingRail items={data.trending} />
          </div>
        </section>
      )}

      <section className="mk-section mk-section-creator" id="creators">
        <div className="mk-container">
          <div className="mk-creator">
            <div className="mk-creator-copy">
              <div
                className="mk-kicker"
                data-reveal
                style={{ "--rd": 0 } as CSSProperties}
              >
                For creators
              </div>
              <h2 data-reveal style={{ "--rd": 1 } as CSSProperties}>
                Built for creators.
                <br />
                Built for community.
              </h2>
              <p data-reveal style={{ "--rd": 2 } as CSSProperties}>
                Mint, list and grow with powerful tools on Solana. Low fees.
                High possibilities.
              </p>
              <span
                className="mk-creator-cta"
                data-reveal
                style={{ "--rd": 3 } as CSSProperties}
              >
                <Link className="mk-primary-btn" href="/create">
                  Start creating <span aria-hidden="true">→</span>
                </Link>
              </span>
            </div>

            <div
              className="mk-creator-stage"
              ref={stageRef}
              data-reveal
              style={{ "--rd": 1 } as CSSProperties}
            >
              {data.collage.length > 0 ? (
                <>
                  <span className="mk-collage-halo" aria-hidden />
                  {data.collage.map((item, i) => (
                    <div
                      className={`mk-collage-pos mk-collage-pos-${i}`}
                      key={`${item.image}-${i}`}
                      style={{ "--cd": i } as CSSProperties}
                    >
                      <Link
                        href={item.href ?? "/collections"}
                        className="mk-collage"
                        aria-label={item.alt}
                      >
                        <img
                          src={item.image}
                          alt={item.alt}
                          loading="lazy"
                          draggable={false}
                        />
                      </Link>
                    </div>
                  ))}
                  <span className="mk-collage-caption" aria-hidden>
                    Collect · Create · Belong
                  </span>
                </>
              ) : (
                <div className="mk-creator-art-empty">
                  <Sparkles size={18} aria-hidden />
                  <span>Collection onboarding opens soon</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
