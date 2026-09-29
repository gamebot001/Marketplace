"use client";

/**
 * Marketplace hero — approved final direction.
 *
 * LEFT: eyebrow "NFT MARKETPLACE ON SOLANA", stacked display typography —
 * DISCOVER / COLLECT / TRADE (Trade highlighted in amber), the approved
 * supporting line, CTAs and marketplace stats.
 *
 * RIGHT: ONE dominant collection tile — a collection-level carousel over the
 * four real projects (Claynosaurz, Mad Lads, DeGods, DGA). The tile slides
 * horizontally between collections as a single unit (artwork + metadata
 * travel together), with next/previous controls, an 01/04 indicator, gentle
 * autoplay and a subtle per-collection accent in the background. No floating
 * NFT cards, no collage.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Artwork } from "@/components/ui/artwork";
import { Reveal } from "@/components/ui/motion";
import { formatSol } from "@/lib/format";
import { DEMO_MODE, demoCollectionStats } from "@/lib/demo-marketplace-data";
import type { MarketplaceCollection } from "@/lib/api/types";
import type { ListingView } from "@/lib/marketplace/views";

interface HeroProps {
  collections: MarketplaceCollection[];
  activeViews: ListingView[];
  dataReady: boolean;
  networkLabel: string;
}

interface HeroSlide {
  slug: string;
  name: string;
  tagline: string;
  /** The collection's own PFP — never another project's artwork. */
  image: string;
  standard: string;
  supply: number;
  verified: boolean;
  href: string;
  /** Subtle per-collection accent used by the atmosphere + tile highlights. */
  accent: string;
  accentGlow: string;
}

/**
 * The four real hero collections, explicitly mapped to their own assets
 * (copied from ~/Desktop/collection-test into /public/demo-marketplace).
 */
const HERO_SLIDES: HeroSlide[] = [
  {
    slug: "claynosaurz",
    name: "Claynosaurz",
    tagline: "Hand-crafted clay dinosaurs living in a miniature prehistoric world.",
    image: "/demo-marketplace/claynosaurz/pfp.avif",
    standard: "Metaplex Core",
    supply: 9999,
    verified: true,
    href: "/collections/claynosaurz",
    accent: "#e8a13c",
    accentGlow: "rgba(232, 161, 60, 0.12)",
  },
  {
    slug: "mad-lads",
    name: "Mad Lads",
    tagline: "Expressive characters built on personality, humour and community.",
    image: "/demo-marketplace/mad-lads/pfp.avif",
    standard: "Metaplex Core",
    supply: 9999,
    verified: true,
    href: "/collections/mad-lads",
    accent: "#e25c3a",
    accentGlow: "rgba(226, 92, 58, 0.11)",
  },
  {
    slug: "degods",
    name: "DeGods",
    tagline: "Pioneering Solana PFPs with a long history of experimentation.",
    image: "/demo-marketplace/degods/pfp.avif",
    standard: "Metaplex Core",
    supply: 9999,
    verified: true,
    href: "/collections/degods",
    accent: "#e9e4d8",
    accentGlow: "rgba(233, 228, 216, 0.09)",
  },
  {
    slug: "dga",
    name: "DGA",
    tagline: "Bold generative artwork for collectors of composition and colour.",
    image: "/demo-marketplace/dga/pfp.avif",
    standard: "Metaplex Core",
    supply: 5000,
    verified: true,
    href: "/collections/dga",
    accent: "#8b6bd9",
    accentGlow: "rgba(139, 107, 217, 0.11)",
  },
];

const SLIDE_COUNT = HERO_SLIDES.length;
const AUTOPLAY_MS = 7000;
const pad2 = (n: number) => String(n).padStart(2, "0");

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function CollectionCarousel({
  onActiveChange,
}: {
  onActiveChange: (slug: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = usePrefersReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);

  const setIndexAndReport = useCallback(
    (next: number) => {
      setIndex(next);
      onActiveChange(HERO_SLIDES[next].slug);
    },
    [onActiveChange]
  );

  const go = useCallback(
    (dir: 1 | -1) =>
      setIndexAndReport((index + dir + SLIDE_COUNT) % SLIDE_COUNT),
    [index, setIndexAndReport]
  );
  const goTo = setIndexAndReport;

  /* Autoplay: gentle 7s cadence, paused on hover/focus, reset whenever the
     index changes (manual navigation restarts the timer), disabled entirely
     under prefers-reduced-motion. */
  useEffect(() => {
    if (paused || reduced) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setIndexAndReport((index + 1) % SLIDE_COUNT);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [paused, reduced, index, setIndexAndReport]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    }
  };

  /* Cursor parallax on the active tile — 2–4px maximum, plus a soft sheen. */
  const onPointerMove = (e: React.PointerEvent) => {
    if (reduced) return;
    const el = stageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.setProperty("--tilt-x", `${(nx * 4).toFixed(2)}px`);
    el.style.setProperty("--tilt-y", `${(ny * 4).toFixed(2)}px`);
    el.style.setProperty("--sheen-x", `${(((e.clientX - rect.left) / rect.width) * 100).toFixed(1)}%`);
    el.style.setProperty("--sheen-y", `${(((e.clientY - rect.top) / rect.height) * 100).toFixed(1)}%`);
  };
  const onPointerLeave = () => {
    const el = stageRef.current;
    if (!el) return;
    el.style.setProperty("--tilt-x", "0px");
    el.style.setProperty("--tilt-y", "0px");
  };

  const active = HERO_SLIDES[index];

  return (
    <div
      className="hero-carousel"
      style={{ "--slide-accent": active.accent } as CSSProperties}
      role="group"
      aria-roledescription="carousel"
      aria-label="Featured collections"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setPaused(false);
      }}
      onKeyDown={onKeyDown}
    >
      {/* one dominant tile — artwork and metadata slide as a single unit */}
      <div
        ref={stageRef}
        className="hero-stage"
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        <span className="hero-sliver" aria-hidden="true" />
        <div
          className={`hero-track${reduced ? " no-motion" : ""}`}
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {HERO_SLIDES.map((slide, i) => {
            const isActive = i === index;
            const stats = DEMO_MODE ? demoCollectionStats(slide.slug) : null;
            return (
              <article
                key={slide.slug}
                className="hero-slide"
                aria-hidden={!isActive}
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${SLIDE_COUNT}: ${slide.name}`}
              >
                <div className="hero-slide-art">
                  <Artwork
                    src={slide.image}
                    alt={`${slide.name} collection artwork`}
                    sizes="(max-width: 980px) 92vw, 480px"
                    priority={i === 0}
                  />
                  <span className="hero-slide-sheen" aria-hidden="true" />
                </div>
                <div className="hero-slide-meta">
                  <div className="hsm-head">
                    <span className="hsm-index">{pad2(i + 1)}</span>
                    <h2 className="hsm-name">{slide.name}</h2>
                    {slide.verified && (
                      <span className="hsm-verified" title="Verified collection">
                        <BadgeCheck size={15} aria-hidden="true" />
                        Verified
                      </span>
                    )}
                  </div>
                  <p className="hsm-tagline">{slide.tagline}</p>
                  <div className="hsm-stats">
                    <span className="hsm-stat">
                      <span className="k">Floor</span>
                      <span className="v">{stats ? formatSol(stats.floorLamports) : "—"}</span>
                    </span>
                    <span className="hsm-stat">
                      <span className="k">Items</span>
                      <span className="v">{slide.supply.toLocaleString("en-US")}</span>
                    </span>
                    <span className="hsm-stat">
                      <span className="k">Standard</span>
                      <span className="v">{slide.standard}</span>
                    </span>
                    <Link
                      href={slide.href}
                      className="hsm-link"
                      tabIndex={isActive ? 0 : -1}
                    >
                      View collection <ArrowUpRight size={13} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* counter + progress + prev/next controls, below the tile */}
      <div className="hero-carousel-bar">
        <div className="hero-carousel-count" aria-live="polite">
          <span className="current">{pad2(index + 1)}</span>
          <span className="sep" aria-hidden="true">
            /
          </span>
          <span className="total">{pad2(SLIDE_COUNT)}</span>
        </div>

        <div className="hero-carousel-progress" aria-hidden="false">
          {HERO_SLIDES.map((slide, i) => (
            <button
              key={slide.slug}
              type="button"
              className={`hero-progress-seg${i === index ? " active" : ""}`}
              aria-label={`Go to ${slide.name}`}
              aria-current={i === index || undefined}
              onClick={() => goTo(i)}
            />
          ))}
        </div>

        <div className="hero-carousel-nav">
          <button
            type="button"
            className="hero-nav-btn"
            onClick={() => go(-1)}
            aria-label="Previous collection"
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="hero-nav-btn"
            onClick={() => go(1)}
            aria-label="Next collection"
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Hero({
  collections,
  activeViews,
  dataReady,
  networkLabel,
}: HeroProps) {
  const verifiedCount = collections.filter(
    (c) => c.verification_status === "verified"
  ).length;
  const activeCount = activeViews.length;
  const [activeSlug, setActiveSlug] = useState(HERO_SLIDES[0].slug);
  const handleActiveChange = useCallback(
    (slug: string) => setActiveSlug(slug),
    []
  );

  return (
    <section className="hero">
      {/* subtle per-collection atmosphere — crossfades with the active slide */}
      <div className="hero-atmos" aria-hidden="true">
        {HERO_SLIDES.map((slide) => (
          <span
            key={slide.slug}
            className="hero-atmo"
            data-active={slide.slug === activeSlug || undefined}
            style={{ "--atmo": slide.accentGlow } as CSSProperties}
          />
        ))}
      </div>

      <div className="container hero-grid">
        <div className="hero-copy">
          <Reveal>
            <span className="eyebrow">NFT Marketplace on Solana</span>
          </Reveal>

          <h1 className="display hero-title">
            <Reveal as="span" className="line" delay={80}>
              Discover
            </Reveal>
            <Reveal as="span" className="line" delay={190}>
              Collect
            </Reveal>
            <Reveal as="span" className="line tint" delay={300}>
              Trade
            </Reveal>
          </h1>

          <Reveal delay={420}>
            <p className="lede">
              A modern NFT marketplace for creators, collectors and communities
              on Solana.
            </p>
          </Reveal>

          <Reveal delay={540}>
            <div className="hero-actions">
              <Link href="/explore" className="btn btn-primary btn-lg">
                Explore Collections <ArrowRight size={16} />
              </Link>
              <Link href="/activity" className="btn btn-outline btn-lg">
                <Activity size={15} /> View Activity
              </Link>
            </div>
          </Reveal>

          {dataReady && collections.length > 0 && (
            <Reveal delay={660}>
              <div className="hero-metrics">
                {verifiedCount > 0 && (
                  <div className="hero-metric">
                    <div className="k">Verified collections</div>
                    <div className="v">{verifiedCount}</div>
                  </div>
                )}
                {activeCount > 0 && (
                  <div className="hero-metric">
                    <div className="k">Live listings</div>
                    <div className="v">{activeCount}</div>
                  </div>
                )}
                <div className="hero-metric">
                  <div className="k">Network</div>
                  <div className="v">
                    {networkLabel.replace("Solana ", "")}
                    <small>test SOL</small>
                  </div>
                </div>
              </div>
            </Reveal>
          )}
        </div>

        <Reveal delay={220} style={{ display: "grid" }}>
          <div className="hero-visual">
            <CollectionCarousel onActiveChange={handleActiveChange} />
          </div>
        </Reveal>
      </div>

      <Reveal delay={760}>
        <div className="scroll-cue" aria-hidden="true">
          Scroll
        </div>
      </Reveal>
    </section>
  );
}
