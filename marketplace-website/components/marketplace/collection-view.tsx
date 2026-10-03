"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  Globe,
  MessageCircle,
  Search,
  Send,
  SlidersHorizontal,
  Twitter,
} from "lucide-react";
import { useCollection, useListingsWithAssets } from "@/lib/api/hooks";
import {
  buildListingViews,
  buildTraitGroups,
  type ListingView,
} from "@/lib/marketplace/views";
import { bpsToPercent, formatSol, resolveImageUrl } from "@/lib/format";
import { NETWORK_LABEL } from "@/lib/config";
import { DEMO_MODE, demoCollectionStats } from "@/lib/demo-marketplace-data";
import { Artwork } from "@/components/ui/artwork";
import { VerifiedBadge } from "@/components/ui/badges";
import { Address } from "@/components/ui/address";
import { CollectibleCard } from "@/components/marketplace/collectible-card";
import { CollectionActivity } from "@/components/marketplace/collection-activity";
import { CardSkeletons } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Reveal } from "@/components/ui/motion";
import styles from "./collection-view.module.css";

type Sort = "recent" | "price-asc" | "price-desc";
type Tab = "nfts" | "activity" | "about";
type ListingFilter = "active" | "sold" | "all";

const SORT_OPTIONS: { id: Sort; label: string }[] = [
  { id: "recent", label: "Recently listed" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
];

function prettyHost(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

const SOCIAL_META: Record<
  string,
  { label: string; Icon: typeof Globe }
> = {
  twitter: { label: "X / Twitter", Icon: Twitter },
  x: { label: "X / Twitter", Icon: Twitter },
  discord: { label: "Discord", Icon: MessageCircle },
  telegram: { label: "Telegram", Icon: Send },
  tg: { label: "Telegram", Icon: Send },
};

function socialMeta(key: string) {
  const normalized = key.toLowerCase();
  return (
    SOCIAL_META[normalized] ?? {
      label: key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      Icon: Globe,
    }
  );
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
  const [nftQuery, setNftQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ListingFilter>("active");
  const [traitFilter, setTraitFilter] = useState("");
  const sortRef = useRef<HTMLDivElement>(null);

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

  const assetMap = useMemo(
    () => listingsState.data?.assets ?? {},
    [listingsState.data]
  );

  /**
   * Gallery entries: one row per asset, preferring the active listing, then the
   * most recent settled one. No asset is ever shown twice.
   */
  const entries = useMemo(() => {
    const byAsset = new Map<string, ListingView>();
    const ordered = [...allViews].sort(
      (a, b) => (b.listing.created_at ?? 0) - (a.listing.created_at ?? 0)
    );
    for (const view of ordered) {
      if (view.listing.status !== "active" && view.listing.status !== "sold") {
        continue;
      }
      const key = view.listing.asset_address;
      const existing = byAsset.get(key);
      if (!existing) {
        byAsset.set(key, view);
        continue;
      }
      if (
        existing.listing.status !== "active" &&
        view.listing.status === "active"
      ) {
        byAsset.set(key, view);
      }
    }
    return [...byAsset.values()];
  }, [allViews]);

  const activeViews = useMemo(
    () => entries.filter((v) => v.listing.status === "active"),
    [entries]
  );

  const traitGroups = useMemo(
    () => buildTraitGroups(entries, assetMap),
    [entries, assetMap]
  );

  const views = useMemo(() => {
    const query = nftQuery.trim().toLowerCase();
    const filtered = entries.filter((view) => {
      if (statusFilter !== "all" && view.listing.status !== statusFilter) {
        return false;
      }
      if (traitFilter) {
        const [trait, value] = traitFilter.split("\u0000");
        const attrs = assetMap[view.listing.asset_address]?.attributes ?? [];
        if (!attrs.some((a) => a.trait === trait && a.value === value)) {
          return false;
        }
      }
      if (query) {
        const haystack = `${view.name} ${view.listing.asset_address}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });

    const sorted = [...filtered];
    if (sort === "price-asc") {
      sorted.sort((a, b) => a.listing.price_lamports - b.listing.price_lamports);
    } else if (sort === "price-desc") {
      sorted.sort((a, b) => b.listing.price_lamports - a.listing.price_lamports);
    } else {
      sorted.sort(
        (a, b) => (b.listing.created_at ?? 0) - (a.listing.created_at ?? 0)
      );
    }
    return sorted;
  }, [entries, assetMap, nftQuery, statusFilter, traitFilter, sort]);

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
  const apiStats = DEMO_MODE ? undefined : collection.stats;

  const floorValue = stats
    ? stats.floorLamports
    : (apiStats?.floor_lamports ??
      (activeViews.length
        ? Math.min(...activeViews.map((v) => v.listing.price_lamports))
        : null));
  const volumeValue = stats ? stats.volumeLamports : (apiStats?.volume_lamports ?? null);
  const supplyValue =
    stats?.supply ?? apiStats?.supply ?? collection.supply ?? null;
  const listedValue =
    stats?.listedCount ?? apiStats?.listed_count ?? activeViews.length;
  const creator =
    allViews.find((v) => v.creatorAddress)?.creatorAddress ?? null;
  const royalty = bpsToPercent(collection.royalty_bps ?? null);

  // Website may live on either the top-level field or the socials map; other
  // social links are shown in About, so keep the two from ever doubling up.
  const website =
    collection.website?.trim() ||
    collection.socials?.website?.trim() ||
    collection.socials?.site?.trim() ||
    null;
  const socials = Object.entries(collection.socials ?? {}).filter(
    ([key, value]) => Boolean(value) && !/^(website|site)$/i.test(key)
  );

  const description = collection.description?.trim() || null;
  const lede =
    description ??
    `Explore the ${collection.name} collection. Browse available pieces, review current listings, and follow the activity around the collection.`;

  const sortLabel =
    SORT_OPTIONS.find((option) => option.id === sort)?.label ?? "Recently listed";

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "nfts", label: "NFTs", count: entries.length },
    { id: "activity", label: "Activity" },
    { id: "about", label: "About" },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.shell}>
        <Reveal className={styles.hero}>
          <div className={styles.heroArt}>
            <div className={styles.artFrame}>
              <Artwork
                src={resolveImageUrl(collection.image)}
                alt={collection.name}
                sizes="(max-width: 980px) 40vw, 320px"
                priority
              />
            </div>
          </div>

          <div className={styles.heroInfo}>
            <span className={styles.kicker}>
              Collection
              {collection.standard ? ` · ${collection.standard}` : ""}
            </span>

            <h1 className={styles.title}>
              {collection.name}
              {verified && <VerifiedBadge label="" />}
            </h1>

            <p className={styles.desc}>{lede}</p>

            {creator && (
              <span className={styles.creatorLine}>
                <span className={styles.creatorLabel}>Creator</span>
                <Address value={creator} head={4} tail={4} link />
              </span>
            )}

            <dl className={styles.stats} aria-label="Collection market snapshot">
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
        <div className={styles.tabsBar}>
          <div className="tab-row" role="tablist" aria-label="Collection sections">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`panel-${t.id}`}
                className="tab-btn"
                onClick={() => setTab(t.id)}
              >
                {t.label}
                {t.count !== undefined && (
                  <span className="tab-count">{t.count}</span>
                )}
              </button>
            ))}
          </div>
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
                <span className={styles.sectionIndex}>NFTs</span>
                <h2 className={styles.sectionTitle}>Browse pieces</h2>
              </div>
              {entries.length > 0 && (
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
            ) : entries.length === 0 ? (
              <EmptyState
                title="Nothing is listed yet"
                message="Nothing from this collection is currently for sale. New listings will appear here."
              />
            ) : (
              <>
                <div className={styles.nftToolbar}>
                  <label className={styles.nftSearch}>
                    <Search size={14} aria-hidden />
                    <input
                      type="search"
                      className="input"
                      placeholder="Search this collection"
                      aria-label="Search NFTs in this collection"
                      value={nftQuery}
                      onChange={(e) => setNftQuery(e.target.value)}
                    />
                  </label>

                  <select
                    className="select"
                    aria-label="Filter by listing status"
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(e.target.value as ListingFilter)
                    }
                  >
                    <option value="active">Listed</option>
                    <option value="sold">Sold</option>
                    <option value="all">All items</option>
                  </select>

                  {traitGroups.length > 0 && (
                    <select
                      className="select"
                      aria-label="Filter by trait"
                      value={traitFilter}
                      onChange={(e) => setTraitFilter(e.target.value)}
                    >
                      <option value="">All traits</option>
                      {traitGroups.map((group) =>
                        group.values.map((value) => (
                          <option
                            key={`${group.trait}-${value}`}
                            value={`${group.trait}\u0000${value}`}
                          >
                            {group.trait}: {value}
                          </option>
                        ))
                      )}
                    </select>
                  )}

                  {views.length !== entries.length && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setNftQuery("");
                        setStatusFilter("active");
                        setTraitFilter("");
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>

                {views.length === 0 ? (
                  <div className={styles.nftEmpty}>
                    <SlidersHorizontal size={16} aria-hidden />
                    <span>No items match these filters.</span>
                  </div>
                ) : (
                  <div className={styles.grid}>
                    {views.map((view, i) => (
                      <CollectibleCard
                        key={view.listing.asset_address}
                        view={view}
                        priority={i < 6}
                      />
                    ))}
                  </div>
                )}
              </>
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
            <div className={styles.sectionHead}>
              <div>
                <span className={styles.sectionIndex}>Activity</span>
                <h2 className={styles.sectionTitle}>
                  Sales, listings &amp; transfers
                </h2>
              </div>
            </div>
            <CollectionActivity
              collectionAddress={address}
              views={allViews}
              limit={12}
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
                <h2 className={styles.sectionTitle}>Details &amp; links</h2>
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
                  <dt className={styles.factK}>Contract</dt>
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
                    ? `${NETWORK_LABEL} · deployed`
                    : `${NETWORK_LABEL} · not deployed`}
                </dd>
              </div>
              {website && (
                <div className={styles.fact}>
                  <dt className={styles.factK}>Website</dt>
                  <dd className={styles.factV}>
                    <a href={website} target="_blank" rel="noreferrer">
                      {prettyHost(website)}
                    </a>
                  </dd>
                </div>
              )}
              {socials.map(([key, value]) => {
                const { label } = socialMeta(key);
                return (
                  <div className={styles.fact} key={key}>
                    <dt className={styles.factK}>{label}</dt>
                    <dd className={styles.factV}>
                      <a href={value} target="_blank" rel="noreferrer">
                        {prettyHost(value)}
                      </a>
                    </dd>
                  </div>
                );
              })}
              <div className={styles.fact}>
                <dt className={styles.factK}>Source</dt>
                <dd className={styles.factV}>
                  {verified
                    ? "Verified collection registered on Zecians"
                    : "Registered on Zecians · unverified"}
                </dd>
              </div>
            </dl>
          </div>
        </section>
      )}
    </div>
  );
}
