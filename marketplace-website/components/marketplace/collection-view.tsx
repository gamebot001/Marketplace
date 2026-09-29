"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Globe } from "lucide-react";
import { useCollection, useListingsWithAssets } from "@/lib/api/hooks";
import { buildListingViews, type ListingView } from "@/lib/marketplace/views";
import { bpsToPercent, formatSol, resolveImageUrl } from "@/lib/format";
import { DEMO_MODE, demoCollectionStats } from "@/lib/demo-marketplace-data";
import { Artwork } from "@/components/ui/artwork";
import { VerifiedBadge } from "@/components/ui/badges";
import { Address } from "@/components/ui/address";
import { CollectibleCard } from "@/components/marketplace/collectible-card";
import { CollectibleModal } from "@/components/marketplace/collectible-modal";
import { CollectionActivity } from "@/components/marketplace/collection-activity";
import { CardSkeletons } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Reveal } from "@/components/ui/motion";
import styles from "./collection-view.module.css";

type Sort = "recent" | "price-asc" | "price-desc";
type Tab = "nfts" | "activity" | "about";

const TABS: { id: Tab; label: string }[] = [
  { id: "nfts", label: "NFTs" },
  { id: "activity", label: "Activity" },
  { id: "about", label: "About" },
];

const SORT_OPTIONS: { id: Sort; label: string }[] = [
  { id: "recent", label: "Recently listed" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
];

function prettyHost(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

export function CollectionView({ slug }: { slug: string }) {
  const { data, error, loading } = useCollection(slug);
  const collection = data?.collection ?? null;
  const address = collection?.collection_address ?? null;

  const listingsState = useListingsWithAssets({
    status: null,
    collectionAddress: address,
  });

  const [sort, setSort] = useState<Sort>("recent");
  const [tab, setTab] = useState<Tab>("nfts");
  const [sortOpen, setSortOpen] = useState(false);
  const [selected, setSelected] = useState<ListingView | null>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<HTMLDivElement>(null);

  // Cursor-reactive highlight on the hero artwork — CSS variables only, set
  // directly on the node. No React state, so moving the pointer never
  // re-renders the page.
  const onArtMove = useCallback((e: React.PointerEvent) => {
    const el = artRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty(
      "--px",
      `${(((e.clientX - rect.left) / rect.width) * 100).toFixed(1)}%`
    );
    el.style.setProperty(
      "--py",
      `${(((e.clientY - rect.top) / rect.height) * 100).toFixed(1)}%`
    );
    // Barely-there parallax: a few pixels opposite the cursor.
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.setProperty("--tx", `${(nx * -6).toFixed(2)}px`);
    el.style.setProperty("--ty", `${(ny * -6).toFixed(2)}px`);
    el.style.setProperty("--glow", "1");
  }, []);

  const onArtLeave = useCallback(() => {
    const el = artRef.current;
    if (!el) return;
    el.style.setProperty("--glow", "0");
    el.style.setProperty("--tx", "0px");
    el.style.setProperty("--ty", "0px");
  }, []);

  // Close the sort menu on an outside press or Escape. One listener while open
  // only — never a per-frame or scroll-bound handler.
  useEffect(() => {
    if (!sortOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!sortRef.current?.contains(e.target as Node)) setSortOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSortOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [sortOpen]);

  const allViews = useMemo(() => {
    if (!address || !listingsState.data) return [];
    return buildListingViews(
      listingsState.data.listings,
      listingsState.data.assets,
      listingsState.data.collections
    ).filter((v) => v.listing.collection_address === address);
  }, [address, listingsState.data]);

  const views = useMemo(() => {
    const active = allViews.filter((v) => v.listing.status === "active");
    const sorted = [...active];
    if (sort === "price-asc") {
      sorted.sort((a, b) => a.listing.price_lamports - b.listing.price_lamports);
    } else if (sort === "price-desc") {
      sorted.sort((a, b) => b.listing.price_lamports - a.listing.price_lamports);
    } else {
      sorted.sort((a, b) => (b.listing.created_at ?? 0) - (a.listing.created_at ?? 0));
    }
    return sorted;
  }, [allViews, sort]);

  if (loading) {
    return (
      <div className={styles.shell} style={{ paddingTop: 34 }}>
        <CardSkeletons count={4} />
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className={styles.shell} style={{ paddingTop: 34 }}>
        <ErrorState
          title="Collection not found"
          message={error ?? "This collection is not registered on the platform."}
          action={
            <Link href="/collections" className="btn btn-outline btn-sm">
              All collections
            </Link>
          }
        />
      </div>
    );
  }

  const verified = collection.verification_status === "verified";
  const stats = DEMO_MODE ? demoCollectionStats(collection.slug) : null;

  const activePrices = views.map((v) => v.listing.price_lamports);
  const floorValue = stats
    ? stats.floorLamports
    : activePrices.length
      ? Math.min(...activePrices)
      : null;
  const volumeValue = stats ? stats.volumeLamports : null;
  const supplyValue = stats?.supply ?? collection.supply ?? null;
  const listedValue = stats?.listedCount ?? views.length;
  const creator =
    allViews.find((v) => v.creatorAddress)?.creatorAddress ?? null;
  const royalty = bpsToPercent(collection.royalty_bps ?? null);
  const socials = Object.entries(collection.socials ?? {}).filter(
    ([, value]) => Boolean(value)
  );
  const sortLabel =
    SORT_OPTIONS.find((option) => option.id === sort)?.label ?? "Recently listed";

  return (
    <div className={styles.page}>
      {/* Route-scoped chrome tweak: the collection page ends after its content. */}
      <style
        dangerouslySetInnerHTML={{ __html: ".mk-footer{display:none!important}" }}
      />
      <div className={styles.atmosphere} aria-hidden="true" />

      <header className={styles.shell}>
        <Reveal className={styles.hero}>
          <div className={styles.heroArt}>
            <div
              className={styles.artFrame}
              ref={artRef}
              onPointerMove={onArtMove}
              onPointerLeave={onArtLeave}
            >
              <Artwork
                src={resolveImageUrl(collection.image)}
                alt={collection.name}
                sizes="(max-width: 980px) 40vw, 360px"
                priority
              />
              <span className={styles.artGlow} aria-hidden />
            </div>
          </div>

          <div className={styles.heroInfo}>
            <h1 className={styles.title}>
              {collection.name}
              {verified && <VerifiedBadge label="" />}
            </h1>

            <p className={styles.desc}>
              {collection.description || "No description provided."}
            </p>

            {creator && (
              <span className={styles.creatorLine}>
                <span className={styles.creatorLabel}>Creator</span>
                <Address value={creator} head={4} tail={4} link />
              </span>
            )}

            {collection.website && (
              <div className={styles.actions}>
                <a
                  className="btn btn-outline"
                  href={collection.website}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Globe size={15} aria-hidden />
                  Website
                </a>
              </div>
            )}

            <dl className={styles.stats} aria-label="Collection stats">
              <div className={styles.stat}>
                <dt className={styles.statK}>Floor</dt>
                <dd className={styles.statV}>
                  {floorValue !== null ? formatSol(floorValue) : "—"}
                </dd>
              </div>
              <div className={styles.stat}>
                <dt className={styles.statK}>Volume</dt>
                <dd className={styles.statV}>
                  {volumeValue !== null ? formatSol(volumeValue) : "—"}
                </dd>
              </div>
              <div className={styles.stat}>
                <dt className={styles.statK}>Items</dt>
                <dd className={styles.statV}>
                  {supplyValue !== null
                    ? supplyValue.toLocaleString("en-US")
                    : "—"}
                </dd>
              </div>
              <div className={styles.stat}>
                <dt className={styles.statK}>Listed</dt>
                <dd className={styles.statV}>{listedValue}</dd>
              </div>
            </dl>

            {DEMO_MODE && (
              <span className={styles.demoNote}>
                Design-preview figures from the demo dataset.
              </span>
            )}
          </div>
        </Reveal>
      </header>

      <nav className={styles.shell} aria-label="Collection sections">
        <div className={styles.tabs} role="tablist" aria-label="Collection sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              className={styles.tab}
              data-active={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {tab === "nfts" && (
        <section
          key="nfts"
          id="panel-nfts"
          role="tabpanel"
          aria-labelledby="tab-nfts"
          className={styles.panel}
          aria-label="NFT listings"
        >
          <div className={styles.shell}>
            <div className={styles.sectionHead}>
              <div>
                <span className={styles.sectionIndex}>Listings</span>
                <h2 className={styles.sectionTitle}>The Collection</h2>
              </div>
              {views.length > 1 && (
                <div className={styles.sortWrap} ref={sortRef}>
                  <button
                    type="button"
                    className={styles.sortBtn}
                    aria-haspopup="listbox"
                    aria-expanded={sortOpen}
                    onClick={() => setSortOpen((open) => !open)}
                  >
                    <span className={styles.sortLabel}>Sort</span>
                    <span className={styles.sortValue}>{sortLabel}</span>
                    <ChevronDown
                      size={14}
                      className={styles.sortChevron}
                      data-open={sortOpen}
                      aria-hidden
                    />
                  </button>

                  <div
                    className={styles.sortMenu}
                    role="listbox"
                    aria-label="Sort listings"
                    data-open={sortOpen}
                  >
                    {SORT_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        role="option"
                        aria-selected={sort === option.id}
                        className={styles.sortOption}
                        data-active={sort === option.id}
                        tabIndex={sortOpen ? 0 : -1}
                        onClick={() => {
                          setSort(option.id);
                          setSortOpen(false);
                        }}
                      >
                        <span>{option.label}</span>
                        {sort === option.id && <Check size={14} aria-hidden />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {!address ? (
              <EmptyState
                title="Nothing is listed yet"
                message="This collection has no on-chain address on this network yet, so there is nothing to list against."
              />
            ) : listingsState.error ? (
              <ErrorState message={listingsState.error} />
            ) : listingsState.loading ? (
              <CardSkeletons count={4} />
            ) : views.length === 0 ? (
              <EmptyState
                title="Nothing is listed yet"
                message="Nothing from this collection is currently for sale. New listings will appear here."
              />
            ) : (
              <div className={styles.grid}>
                {views.map((view, i) => (
                  <CollectibleCard
                    key={view.listing.listing_id}
                    view={view}
                    priority={i < 6}
                    onSelect={setSelected}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {tab === "activity" && (
        <section
          key="activity"
          id="panel-activity"
          role="tabpanel"
          aria-labelledby="tab-activity"
          className={styles.panel}
          aria-label="Collection activity"
        >
          <div className={styles.shell}>
            <CollectionActivity
              collectionAddress={address}
              views={allViews}
              limit={12}
              onSelect={setSelected}
            />
          </div>
        </section>
      )}

      {tab === "about" && (
        <section
          key="about"
          id="panel-about"
          role="tabpanel"
          aria-labelledby="tab-about"
          className={styles.panel}
          aria-label="About collection"
        >
          <div className={styles.shell}>
            <div className={styles.sectionHead}>
              <div>
                <span className={styles.sectionIndex}>About</span>
                <h2 className={styles.sectionTitle}>Specs &amp; links</h2>
              </div>
            </div>

            <dl className={styles.facts}>
              <div className={styles.fact}>
                <dt className={styles.factK}>Standard</dt>
                <dd className={styles.factV}>{collection.standard}</dd>
              </div>
              {royalty && (
                <div className={styles.fact}>
                  <dt className={styles.factK}>Royalty</dt>
                  <dd className={styles.factV}>{royalty}</dd>
                </div>
              )}
              {collection.collection_address && (
                <div className={styles.fact}>
                  <dt className={styles.factK}>Collection</dt>
                  <dd className={styles.factV}>
                    <Address
                      value={collection.collection_address}
                      head={5}
                      tail={5}
                      link
                    />
                  </dd>
                </div>
              )}
              <div className={styles.fact}>
                <dt className={styles.factK}>Chain</dt>
                <dd className={styles.factV}>
                  {collection.chain_deployed
                    ? "Deployed on-chain"
                    : "Not deployed"}
                </dd>
              </div>
              {socials.map(([key, value]) => (
                <div className={styles.fact} key={key}>
                  <dt className={styles.factK}>{key}</dt>
                  <dd className={styles.factV}>
                    <a href={value} target="_blank" rel="noreferrer">
                      {prettyHost(value)}
                    </a>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      {selected && (
        <CollectibleModal
          view={selected}
          asset={
            listingsState.data?.assets?.[selected.listing.asset_address] ?? null
          }
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
