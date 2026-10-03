"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  Activity as ActivityIcon,
  ArrowRight,
  ChevronRight,
  ExternalLink,
  Heart,
  LayoutDashboard,
  Library,
  LogOut,
  Package,
  Tag,
  Wallet as WalletIcon,
  type LucideIcon,
} from "lucide-react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useActivity, useListingsWithAssets } from "@/lib/api/hooks";
import {
  activityLabel,
  buildListingViews,
  type ListingView,
} from "@/lib/marketplace/views";
import {
  formatSolRounded,
  lamportsToSolRounded,
  relativeTime,
  resolveImageUrl,
  shorten,
} from "@/lib/format";
import { explorerAddressUrl, explorerTxUrl } from "@/lib/solana/cluster";
import { IS_DEVNET } from "@/lib/config";
import type {
  ActivityEvent,
  MarketplaceAsset,
  MarketplaceCollection,
} from "@/lib/api/types";
import { Artwork } from "@/components/ui/artwork";
import { Address } from "@/components/ui/address";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { CardSkeletons } from "@/components/ui/skeleton";
import { useWalletDialog } from "@/components/wallet/wallet-provider";
import { useWatchlist } from "@/components/marketplace/watchlist";
import { useNftQuickView } from "@/components/marketplace/nft-quick-view";
import { useTransaction } from "@/components/marketplace/transaction/transaction-provider";

type SectionId =
  | "summary"
  | "owned"
  | "listed"
  | "activity"
  | "watchlist"
  | "collections";

const SECTION_META: Record<
  SectionId,
  { eyebrow: string; title: string; noun: string }
> = {
  summary: { eyebrow: "Profile", title: "Your portfolio", noun: "" },
  owned: { eyebrow: "Owned", title: "Owned assets", noun: "asset" },
  listed: { eyebrow: "Listed", title: "Active listings", noun: "listing" },
  activity: { eyebrow: "Activity", title: "Wallet activity", noun: "event" },
  watchlist: { eyebrow: "Watchlist", title: "Watchlist", noun: "item" },
  collections: {
    eyebrow: "Collections",
    title: "Your collections",
    noun: "collection",
  },
};

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #f4b658, #e07f2e)",
  "linear-gradient(135deg, #e8a13c, #b85a2a)",
  "linear-gradient(135deg, #e0b878, #a06a2e)",
  "linear-gradient(135deg, #cf7a6c, #8a3d2e)",
  "linear-gradient(135deg, #d99a5b, #7a4a20)",
];

function avatarGradient(address: string): string {
  let hash = 0;
  for (let i = 0; i < address.length; i += 1) {
    hash = (hash * 31 + address.charCodeAt(i)) >>> 0;
  }
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

function activityKind(
  type: string | null | undefined
): "sale" | "list" | "cancel" | "transfer" | "muted" {
  if (!type) return "muted";
  if (/sale|sold/i.test(type)) return "sale";
  if (/cancel/i.test(type)) return "cancel";
  if (/list/i.test(type)) return "list";
  if (/transfer|mint/i.test(type)) return "transfer";
  return "muted";
}

function involvesAddress(event: ActivityEvent, address: string): boolean {
  return (
    event.seller_address === address ||
    event.buyer_address === address ||
    event.from_address === address ||
    event.to_address === address
  );
}

function plural(count: number, noun: string): string {
  return `${count.toLocaleString("en-US")} ${noun}${count === 1 ? "" : "s"}`;
}

function ProfileTable({
  columns,
  children,
}: {
  columns: string;
  children: ReactNode;
}) {
  return (
    <div className="pv-table-scroll">
      <div className="pv-table" style={{ "--pv-cols": columns } as CSSProperties}>
        {children}
      </div>
    </div>
  );
}

function PvRow({
  onClick,
  children,
}: {
  onClick?: () => void;
  children: ReactNode;
}) {
  const clickable = Boolean(onClick);
  return (
    <div
      className="pv-row"
      data-clickable={clickable ? "true" : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        clickable
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}

function AssetCell({
  image,
  name,
  sub,
  badge,
}: {
  image: string | null;
  name: string;
  sub?: string;
  badge?: ReactNode;
}) {
  return (
    <span className="pv-assetcell">
      <span className="pv-thumb">
        <Artwork src={image} alt={name} sizes="44px" />
        {badge}
      </span>
      <span className="pv-name">
        <span className="pv-name-main">{name}</span>
        {sub ? <span className="pv-name-sub">{sub}</span> : null}
      </span>
    </span>
  );
}

export function ProfileView() {
  const { connected, publicKey, wallet, disconnect } = useWallet();
  const { connection } = useConnection();
  const { open: openWalletDialog } = useWalletDialog();
  const { open: openNft } = useNftQuickView();
  const { request } = useTransaction();
  const { items: watchlist } = useWatchlist();

  const address = publicKey?.toBase58() ?? null;
  const listingsState = useListingsWithAssets({ status: null, ownerAddress: address });
  const activityState = useActivity(200);

  const [balance, setBalance] = useState<number | null>(null);
  const [balanceError, setBalanceError] = useState(false);
  const [section, setSection] = useState<SectionId>("summary");
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!publicKey) {
      setBalance(null);
      setBalanceError(false);
      return;
    }
    let active = true;
    setBalance(null);
    setBalanceError(false);
    connection
      .getBalance(publicKey, "confirmed")
      .then((lamports) => {
        if (active) setBalance(lamports);
      })
      .catch(() => {
        if (active) {
          setBalance(null);
          setBalanceError(true);
        }
      });
    return () => {
      active = false;
    };
  }, [connection, publicKey]);

  const data = listingsState.data;

  // Collections the profile may present: the registry response is already
  // filtered to publicly visible collections by the backend.
  const publicCollectionAddresses = useMemo(() => {
    const set = new Set<string>();
    for (const collection of data?.collections ?? []) {
      if (collection.collection_address) set.add(collection.collection_address);
    }
    return set;
  }, [data]);

  // Assets from a known-but-hidden collection (legacy/placeholder) are never
  // presented in the public profile. When the registry response is missing we
  // cannot classify, so nothing is hidden on incomplete data.
  const isVisibleCollectionAddress = useCallback(
    (collectionAddress: string | null | undefined): boolean => {
      if (!collectionAddress) return true;
      if (publicCollectionAddresses.size === 0) return true;
      return publicCollectionAddresses.has(collectionAddress);
    },
    [publicCollectionAddresses]
  );

  const allViews = useMemo(
    () =>
      data
        ? buildListingViews(data.listings, data.assets, data.collections)
        : [],
    [data]
  );

  const ownedAssets = useMemo(() => {
    if (!data || !address) return [] as MarketplaceAsset[];
    return Object.values(data.assets).filter(
      (a) =>
        a.owner_address === address &&
        isVisibleCollectionAddress(a.collection_address)
    );
  }, [data, address, isVisibleCollectionAddress]);

  const listedViews = useMemo(
    () =>
      allViews.filter(
        (v) =>
          v.listing.seller_address === address &&
          v.listing.status === "active" &&
          isVisibleCollectionAddress(v.listing.collection_address)
      ),
    [allViews, address, isVisibleCollectionAddress]
  );

  const watchlistAssets = useMemo(() => {
    if (!data) return [] as MarketplaceAsset[];
    return watchlist
      .map((assetAddress) => data.assets[assetAddress])
      .filter(
        (a): a is MarketplaceAsset =>
          Boolean(a) && isVisibleCollectionAddress(a?.collection_address)
      );
  }, [data, watchlist, isVisibleCollectionAddress]);

  const myActivity = useMemo(() => {
    if (!address) return [] as ActivityEvent[];
    return (activityState.data ?? []).filter((event) => {
      if (!involvesAddress(event, address)) return false;
      // Profile activity respects marketplace public visibility: events for a
      // known collection that is not publicly visible are hidden.
      return isVisibleCollectionAddress(event.collection_address);
    });
  }, [activityState.data, address, isVisibleCollectionAddress]);

  const myCollections = useMemo(() => {
    if (!data || !address) return [] as MarketplaceCollection[];
    const addresses = new Set(
      ownedAssets
        .map((a) => a.collection_address)
        .filter((a): a is string => Boolean(a))
    );
    return data.collections.filter(
      (c) => c.collection_address && addresses.has(c.collection_address)
    );
  }, [data, address, ownedAssets]);

  const collectionNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const collection of data?.collections ?? []) {
      if (collection.collection_address) {
        map.set(collection.collection_address, collection.name);
      }
    }
    return map;
  }, [data]);

  const collectionOwnedCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const asset of ownedAssets) {
      if (!asset.collection_address) continue;
      map.set(
        asset.collection_address,
        (map.get(asset.collection_address) ?? 0) + 1
      );
    }
    return map;
  }, [ownedAssets]);

  const collectionListedCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const view of listedViews) {
      const key = view.listing.collection_address;
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [listedViews]);

  // Active listing per asset — the current market price shown on Owned.
  const activeViewByAsset = useMemo(() => {
    const map = new Map<string, ListingView>();
    for (const view of allViews) {
      if (view.listing.status === "active") {
        map.set(view.listing.asset_address, view);
      }
    }
    return map;
  }, [allViews]);

  // Most recent real sale per asset, derived from indexed sold listings only.
  const lastSaleByAsset = useMemo(() => {
    const map = new Map<string, number>();
    const createdAt = new Map<string, number>();
    for (const view of allViews) {
      if (view.listing.status !== "sold") continue;
      const asset = view.listing.asset_address;
      const at = view.listing.created_at ?? 0;
      if (!createdAt.has(asset) || at > createdAt.get(asset)!) {
        createdAt.set(asset, at);
        map.set(asset, view.listing.price_lamports);
      }
    }
    return map;
  }, [allViews]);

  const listedAssetSet = useMemo(
    () => new Set(listedViews.map((v) => v.listing.asset_address)),
    [listedViews]
  );

  const listedCount = listedViews.length;
  const heldCount = ownedAssets.filter(
    (a) => !listedAssetSet.has(a.asset_address)
  ).length;
  const listingsTotal = listedViews.reduce(
    (sum, v) => sum + BigInt(v.listing.price_lamports ?? 0),
    BigInt(0)
  );

  const selectSection = useCallback((id: SectionId) => {
    setSection(id);
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const nameFor = (asset: MarketplaceAsset | null | undefined): string =>
    asset?.name?.trim() ||
    (asset ? shorten(asset.asset_address, 5, 5) : "Unknown asset");

  const collectionFor = (
    asset: MarketplaceAsset | null | undefined
  ): string =>
    (asset?.collection_address
      ? collectionNames.get(asset.collection_address)
      : undefined) ?? "Unregistered collection";

  const handleDisconnect = useCallback(() => {
    void disconnect();
  }, [disconnect]);

  const providerName = wallet?.adapter.name || "Wallet";
  const networkLabel = IS_DEVNET ? "Devnet" : "Mainnet";

  const balanceText = balanceError
    ? "—"
    : balance === null
      ? "…"
      : lamportsToSolRounded(balance);
  const balanceUnit = !balanceError && balance !== null ? "SOL" : undefined;

  const navEntries: {
    id: SectionId;
    label: string;
    icon: LucideIcon;
    count: number | null;
  }[] = [
    { id: "summary", label: "Summary", icon: LayoutDashboard, count: null },
    { id: "owned", label: "Owned", icon: Package, count: ownedAssets.length },
    { id: "listed", label: "Listed", icon: Tag, count: listedViews.length },
    {
      id: "activity",
      label: "Activity",
      icon: ActivityIcon,
      count: myActivity.length,
    },
    {
      id: "watchlist",
      label: "Watchlist",
      icon: Heart,
      count: watchlistAssets.length,
    },
    {
      id: "collections",
      label: "Collections",
      icon: Library,
      count: myCollections.length,
    },
  ];

  const meta = SECTION_META[section];

  if (!connected || !publicKey || !address) {
    return (
      <div className="pv-root pv-root-connect">
        <main className="pv-connect">
          <div className="pv-connect-card">
            <EmptyState
              icon={<WalletIcon size={20} />}
              title="Connect your wallet"
              message="Connect a Solana wallet to view your owned assets, active listings and activity."
              action={
                <div className="pv-connect-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={openWalletDialog}
                  >
                    <WalletIcon size={15} /> Connect Wallet
                  </button>
                  <Link href="/explore" className="btn btn-outline">
                    Explore marketplace
                  </Link>
                </div>
              }
            />
          </div>
        </main>
        <ProfileStyles />
      </div>
    );
  }

  const connectedAddress = address;
  const openAsset = (
    asset: MarketplaceAsset,
    view?: ListingView | null
  ) =>
    openNft({
      address: asset.asset_address,
      asset,
      view: view ?? activeViewByAsset.get(asset.asset_address) ?? undefined,
    });

  const sectionCount =
    section === "owned"
      ? ownedAssets.length
      : section === "listed"
        ? listedViews.length
        : section === "activity"
          ? myActivity.length
          : section === "watchlist"
            ? watchlistAssets.length
            : section === "collections"
              ? myCollections.length
              : 0;

  let content: ReactNode = null;

  if (listingsState.loading && section !== "activity") {
    content = <CardSkeletons count={4} />;
  } else if (listingsState.error && section !== "activity") {
    content = <ErrorState message={listingsState.error} />;
  } else if (section === "activity") {
    if (activityState.loading) {
      content = <CardSkeletons count={3} />;
    } else if (activityState.error) {
      content = <ErrorState message={activityState.error} />;
    } else if (myActivity.length === 0) {
      content = (
        <EmptyState
          icon={<ActivityIcon size={18} />}
          title="No activity yet"
          message="Your marketplace activity will appear here once it is observed on-chain."
        />
      );
    } else {
      content = (
        <ProfileTable columns="minmax(0, 2fr) minmax(0, 1.1fr) 96px 108px 84px 84px">
          <div className="pv-headrow">
            {["Asset", "Collection", "Event", "Price", "Time", "Transaction"].map(
              (label) => (
                <span key={label} className="pv-th">
                  {label}
                </span>
              )
            )}
          </div>
          {myActivity.map((event, index) => {
            const asset = event.asset_address
              ? data?.assets[event.asset_address]
              : undefined;
            const assetAddress = event.asset_address;
            return (
              <PvRow
                key={`${event.signature}-${index}`}
                onClick={
                  assetAddress
                    ? () =>
                        openNft({
                          address: assetAddress,
                          asset: asset ?? undefined,
                        })
                    : undefined
                }
              >
                <AssetCell
                  image={resolveImageUrl(
                    asset?.image ?? asset?.metadata_uri ?? null
                  )}
                  name={nameFor(asset)}
                  sub={asset ? collectionFor(asset) : undefined}
                  badge={
                    <span
                      className="pv-kind"
                      data-kind={activityKind(event.type)}
                      aria-hidden
                    />
                  }
                />
                <span className="pv-cell pv-muted">
                  {asset ? collectionFor(asset) : "—"}
                </span>
                <span className="pv-cell">
                  <span className="pv-event" data-kind={activityKind(event.type)}>
                    {activityLabel(event)}
                  </span>
                </span>
                <span className="pv-cell pv-mono">
                  {event.lamports !== null && event.lamports !== undefined
                    ? formatSolRounded(event.lamports)
                    : "—"}
                </span>
                <span className="pv-cell pv-mono pv-muted">
                  {relativeTime(event.block_time ?? event.now) ?? "—"}
                </span>
                <span className="pv-cell pv-action">
                  <a
                    className="pv-explorer"
                    href={explorerTxUrl(event.signature)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    aria-label="View transaction in explorer"
                  >
                    Explorer <ExternalLink size={11} aria-hidden />
                  </a>
                </span>
              </PvRow>
            );
          })}
        </ProfileTable>
      );
    }
  } else if (section === "owned") {
    content =
      ownedAssets.length === 0 ? (
        <EmptyState
          title="No owned assets"
          message="Assets you own that the marketplace has indexed will appear here."
        />
      ) : (
        <ProfileTable columns="minmax(0, 2fr) minmax(0, 1.1fr) 116px 130px 130px 84px">
          <div className="pv-headrow">
            {[
              "Asset",
              "Collection",
              "Status",
              "Current price",
              "Last sale",
              "Action",
            ].map((label) => (
              <span key={label} className="pv-th">
                {label}
              </span>
            ))}
          </div>
          {ownedAssets.map((asset) => {
            const listed = listedAssetSet.has(asset.asset_address);
            const view = activeViewByAsset.get(asset.asset_address) ?? null;
            const lastSale = lastSaleByAsset.get(asset.asset_address);
            return (
              <PvRow
                key={asset.asset_address}
                onClick={() => openAsset(asset, view)}
              >
                <AssetCell
                  image={resolveImageUrl(
                    asset.image ?? asset.metadata_uri ?? null
                  )}
                  name={nameFor(asset)}
                  sub={shorten(asset.asset_address, 5, 5)}
                />
                <span className="pv-cell pv-muted">
                  {collectionFor(asset)}
                </span>
                <span className="pv-cell">
                  <span className="pv-status" data-status={listed ? "active" : "unlisted"}>
                    {listed ? "Listed" : "Not listed"}
                  </span>
                </span>
                <span className="pv-cell pv-mono">
                  {listed && view
                    ? formatSolRounded(view.listing.price_lamports)
                    : "—"}
                </span>
                <span className="pv-cell pv-mono pv-muted">
                  {lastSale !== undefined ? formatSolRounded(lastSale) : "—"}
                </span>
                <span className="pv-cell pv-action">
                  <span className="pv-view">
                    View <ChevronRight size={13} aria-hidden />
                  </span>
                </span>
              </PvRow>
            );
          })}
        </ProfileTable>
      );
  } else if (section === "listed") {
    content =
      listedViews.length === 0 ? (
        <EmptyState
          title="No active listings"
          message="Assets you list for sale will appear here."
        />
      ) : (
        <ProfileTable columns="minmax(0, 2fr) minmax(0, 1.1fr) 130px 110px 150px">
          <div className="pv-headrow">
            {["Asset", "Collection", "Price", "Listed", "Action"].map((label) => (
              <span key={label} className="pv-th">
                {label}
              </span>
            ))}
          </div>
          {listedViews.map((view) => {
            const asset = data?.assets[view.listing.asset_address];
            return (
              <PvRow
                key={view.listing.listing_id}
                onClick={() =>
                  openNft({
                    address: view.listing.asset_address,
                    asset: asset ?? undefined,
                    view,
                  })
                }
              >
                <AssetCell
                  image={view.image}
                  name={view.name}
                  sub={shorten(view.listing.asset_address, 5, 5)}
                />
                <span className="pv-cell pv-muted">{view.collectionName}</span>
                <span className="pv-cell pv-mono">
                  {formatSolRounded(view.listing.price_lamports)}
                </span>
                <span className="pv-cell pv-mono pv-muted">
                  {relativeTime(view.listing.created_at) ?? "—"}
                </span>
                <span className="pv-cell pv-action">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      request({ kind: "cancel", view });
                    }}
                  >
                    Cancel
                  </button>
                </span>
              </PvRow>
            );
          })}
        </ProfileTable>
      );
  } else if (section === "watchlist") {
    content =
      watchlistAssets.length === 0 ? (
        <EmptyState
          icon={<Heart size={18} />}
          title="No watchlist items"
          message="Assets you add to your watchlist will appear here."
          action={
            <Link href="/explore" className="btn btn-outline btn-sm">
              Explore listings
            </Link>
          }
        />
      ) : (
        <ProfileTable columns="minmax(0, 2fr) minmax(0, 1.1fr) 116px 130px 84px">
          <div className="pv-headrow">
            {["Asset", "Collection", "Status", "Current price", "Action"].map(
              (label) => (
                <span key={label} className="pv-th">
                  {label}
                </span>
              )
            )}
          </div>
          {watchlistAssets.map((asset) => {
            const view = activeViewByAsset.get(asset.asset_address) ?? null;
            const listed = Boolean(view);
            return (
              <PvRow
                key={asset.asset_address}
                onClick={() => openAsset(asset, view)}
              >
                <AssetCell
                  image={resolveImageUrl(
                    asset.image ?? asset.metadata_uri ?? null
                  )}
                  name={nameFor(asset)}
                  sub={shorten(asset.asset_address, 5, 5)}
                />
                <span className="pv-cell pv-muted">
                  {collectionFor(asset)}
                </span>
                <span className="pv-cell">
                  <span
                    className="pv-status"
                    data-status={listed ? "active" : "unlisted"}
                  >
                    {listed ? "Listed" : "Not listed"}
                  </span>
                </span>
                <span className="pv-cell pv-mono">
                  {listed && view
                    ? formatSolRounded(view.listing.price_lamports)
                    : "—"}
                </span>
                <span className="pv-cell pv-action">
                  <span className="pv-view">
                    View <ChevronRight size={13} aria-hidden />
                  </span>
                </span>
              </PvRow>
            );
          })}
        </ProfileTable>
      );
  } else if (section === "collections") {
    content =
      myCollections.length === 0 ? (
        <EmptyState
          title="No collections yet"
          message="Collections you own will appear here."
        />
      ) : (
        <div className="pv-collections">
          {myCollections.map((collection) => {
            const owned = collection.collection_address
              ? collectionOwnedCounts.get(collection.collection_address) ?? 0
              : 0;
            const listed = collection.collection_address
              ? collectionListedCounts.get(collection.collection_address) ?? 0
              : 0;
            return (
              <Link
                key={collection.slug}
                href={`/collections/${collection.slug}`}
                className="pv-collcard"
              >
                <span className="pv-collthumb">
                  <Artwork
                    src={resolveImageUrl(collection.image)}
                    alt={collection.name}
                    sizes="64px"
                  />
                </span>
                <span className="pv-collbody">
                  <span className="pv-collname">{collection.name}</span>
                  <span className="pv-collmeta">
                    {plural(owned, "owned")}
                    {listed > 0 ? ` · ${plural(listed, "listed")}` : ""}
                  </span>
                </span>
                <span className="pv-collview">
                  View <ArrowRight size={13} aria-hidden />
                </span>
              </Link>
            );
          })}
        </div>
      );
  } else {
    content = (
      <div className="pv-summary">
        <div className="pv-strip" role="list">
          <div className="pv-stat" role="listitem">
            <span className="pv-stat-label">Balance</span>
            <span className="pv-stat-value pv-mono">
              {balanceText}
              {balanceUnit ? <small>{balanceUnit}</small> : null}
            </span>
          </div>
          <div className="pv-stat" role="listitem">
            <span className="pv-stat-label">Owned</span>
            <span className="pv-stat-value">
              {listingsState.loading ? "…" : ownedAssets.length}
            </span>
            <span className="pv-stat-sub">
              {listedCount} listed · {heldCount} held
            </span>
          </div>
          <div className="pv-stat" role="listitem">
            <span className="pv-stat-label">Listed</span>
            <span className="pv-stat-value">
              {listingsState.loading ? "…" : listedCount}
            </span>
            <span className="pv-stat-sub">
              {listedCount === 0
                ? "No active listings"
                : `Asking ${formatSolRounded(listingsTotal)}`}
            </span>
          </div>
          <div className="pv-stat" role="listitem">
            <span className="pv-stat-label">Collections</span>
            <span className="pv-stat-value">
              {listingsState.loading ? "…" : myCollections.length}
            </span>
            <span className="pv-stat-sub">
              {myCollections.length === 0 ? "No collections yet" : "Owned"}
            </span>
          </div>
        </div>

        <div className="pv-overview">
          <div className="pv-panel">
            <div className="pv-panel-head">
              <h2>Recent activity</h2>
              {myActivity.length > 0 ? (
                <button
                  type="button"
                  className="pv-panel-link"
                  onClick={() => selectSection("activity")}
                >
                  View all activity <ArrowRight size={13} aria-hidden />
                </button>
              ) : null}
            </div>
            {activityState.loading && myActivity.length === 0 ? (
              <CardSkeletons count={2} />
            ) : myActivity.length === 0 ? (
              <p className="pv-panel-empty">
                Your marketplace activity will appear here once it is observed
                on-chain.
              </p>
            ) : (
              <div className="pv-minilist">
                {myActivity.slice(0, 6).map((event, index) => {
                  const asset = event.asset_address
                    ? data?.assets[event.asset_address]
                    : undefined;
                  const assetAddress = event.asset_address;
                  return (
                    <div
                      key={`${event.signature}-${index}`}
                      className="pv-minirow"
                      role={assetAddress ? "button" : undefined}
                      tabIndex={assetAddress ? 0 : undefined}
                      onClick={
                        assetAddress
                          ? () =>
                              openNft({
                                address: assetAddress,
                                asset: asset ?? undefined,
                              })
                          : undefined
                      }
                      onKeyDown={
                        assetAddress
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                openNft({
                                  address: assetAddress,
                                  asset: asset ?? undefined,
                                });
                              }
                            }
                          : undefined
                      }
                    >
                      <span className="pv-mini-thumb">
                        <Artwork
                          src={resolveImageUrl(
                            asset?.image ?? asset?.metadata_uri ?? null
                          )}
                          alt=""
                          sizes="34px"
                        />
                      </span>
                      <span className="pv-mini-main">
                        <span className="pv-mini-name">{nameFor(asset)}</span>
                        <span className="pv-mini-sub">
                          {asset ? collectionFor(asset) : "—"}
                        </span>
                      </span>
                      <span
                        className="pv-event"
                        data-kind={activityKind(event.type)}
                      >
                        {activityLabel(event)}
                      </span>
                      <span className="pv-mini-price pv-mono">
                        {event.lamports !== null && event.lamports !== undefined
                          ? formatSolRounded(event.lamports)
                          : "—"}
                      </span>
                      <span className="pv-mini-time">
                        {relativeTime(event.block_time ?? event.now) ?? "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pv-panel">
            <div className="pv-panel-head">
              <h2>Your collections</h2>
              {myCollections.length > 0 ? (
                <button
                  type="button"
                  className="pv-panel-link"
                  onClick={() => selectSection("collections")}
                >
                  View all <ArrowRight size={13} aria-hidden />
                </button>
              ) : null}
            </div>
            {myCollections.length === 0 ? (
              <p className="pv-panel-empty">
                Collections you own will appear here.
              </p>
            ) : (
              <div className="pv-minilist">
                {myCollections.slice(0, 6).map((collection) => {
                  const owned = collection.collection_address
                    ? collectionOwnedCounts.get(collection.collection_address) ??
                      0
                    : 0;
                  const listed = collection.collection_address
                    ? collectionListedCounts.get(collection.collection_address) ??
                      0
                    : 0;
                  return (
                    <Link
                      key={collection.slug}
                      href={`/collections/${collection.slug}`}
                      className="pv-minirow pv-minirow-link"
                    >
                      <span className="pv-mini-thumb">
                        <Artwork
                          src={resolveImageUrl(collection.image)}
                          alt=""
                          sizes="34px"
                        />
                      </span>
                      <span className="pv-mini-main">
                        <span className="pv-mini-name">
                          {collection.name}
                        </span>
                        <span className="pv-mini-sub">
                          {plural(owned, "owned")}
                          {listed > 0 ? ` · ${plural(listed, "listed")}` : ""}
                        </span>
                      </span>
                      <span className="pv-mini-time">
                        <ArrowRight size={13} aria-hidden />
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {ownedAssets.length > 0 ? (
          <section className="pv-assets">
            <div className="pv-assets-head">
              <h2>Your assets</h2>
              <span className="pv-assets-count">
                {plural(ownedAssets.length, "asset")}
              </span>
            </div>
            <div className="pv-assets-row">
              {ownedAssets.slice(0, 6).map((asset) => {
                const view = activeViewByAsset.get(asset.asset_address) ?? null;
                return (
                  <button
                    key={asset.asset_address}
                    type="button"
                    className="pv-assetcard"
                    onClick={() => openAsset(asset, view)}
                    aria-label={`View ${nameFor(asset)}`}
                  >
                    <span className="pv-assetcard-media">
                      <Artwork
                        src={resolveImageUrl(
                          asset.image ?? asset.metadata_uri ?? null
                        )}
                        alt={nameFor(asset)}
                        sizes="180px"
                      />
                    </span>
                    <span className="pv-assetcard-info">
                      <span className="pv-assetcard-name">
                        {nameFor(asset)}
                      </span>
                      <span className="pv-assetcard-price pv-mono">
                        {view
                          ? formatSolRounded(view.listing.price_lamports)
                          : "Not listed"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  const navButton = (entry: (typeof navEntries)[number]) => {
    const Icon = entry.icon;
    const active = section === entry.id;
    return (
      <button
        key={entry.id}
        type="button"
        className="pv-navitem"
        aria-current={active ? "page" : undefined}
        onClick={() => selectSection(entry.id)}
      >
        <Icon size={15} aria-hidden />
        <span className="pv-navlabel">{entry.label}</span>
        {entry.count !== null ? (
          <span className="pv-navcount">{entry.count}</span>
        ) : null}
      </button>
    );
  };

  return (
    <div className="pv-root">
      <aside className="pv-sidebar">
        <div className="pv-ident">
          <span className="pv-avatar-wrap" aria-hidden>
            <span
              className="pv-avatar"
              style={{ background: avatarGradient(address) }}
            />
            <span className="pv-online-dot" />
          </span>
          <span className="pv-ident-text">
            <span className="pv-ident-name">{shorten(address, 4, 4)}</span>
            <span className="pv-ident-meta">
              {providerName}
              <span className="pv-meta-dot">·</span>
              {networkLabel}
            </span>
          </span>
        </div>

        <div className="pv-balance">
          <span className="pv-balance-label">Balance</span>
          <span className="pv-balance-value">
            {balanceText}
            {balanceUnit ? <small>{balanceUnit}</small> : null}
          </span>
        </div>

        <nav className="pv-nav" aria-label="Profile sections">
          {navEntries.map(navButton)}
        </nav>

        <div className="pv-sidefoot">
          <button
            type="button"
            className="btn btn-danger btn-sm btn-block"
            onClick={handleDisconnect}
          >
            <LogOut size={14} aria-hidden /> Disconnect
          </button>
        </div>
      </aside>

      <main className="pv-main" ref={mainRef}>
        <div className="pv-mobilebar">
          <nav className="pv-mobilenav" aria-label="Profile sections">
            {navEntries.map(navButton)}
          </nav>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleDisconnect}
            aria-label="Disconnect wallet"
          >
            <LogOut size={15} aria-hidden />
          </button>
        </div>

        <header className="pv-head">
          <div className="pv-headtop">
            <span className="pv-crumb">{meta.eyebrow}</span>
            <span className="pv-headaddr">
              <Address value={connectedAddress} head={4} tail={4} />
              <a
                className="copy-btn"
                href={explorerAddressUrl(connectedAddress)}
                target="_blank"
                rel="noreferrer"
              >
                Explorer <ExternalLink size={12} aria-hidden />
              </a>
            </span>
          </div>
          <div className="pv-headtitle">
            <h1 className="pv-title">{meta.title}</h1>
            {section !== "summary" ? (
              <span className="pv-subtitle">
                {plural(sectionCount, meta.noun)}
              </span>
            ) : null}
          </div>
        </header>

        <div
          className="pv-content"
          aria-live="polite"
          role="region"
          aria-label={`${meta.title} section`}
        >
          {content}
        </div>
      </main>

      <ProfileStyles />
    </div>
  );
}

function ProfileStyles() {
  return (
    <style jsx global>{`
.pv-root {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  height: calc(100vh - var(--mk-chrome-top));
  min-height: 540px;
  background: var(--bg);
  color: var(--text);
}
.pv-root-connect {
  grid-template-columns: minmax(0, 1fr);
}
.pv-sidebar {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-right: 1px solid var(--line);
  background: var(--surface-2);
  overflow: hidden;
}
.pv-ident {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 20px 14px;
}
.pv-avatar-wrap {
  position: relative;
  width: 44px;
  height: 44px;
  flex: none;
}
.pv-avatar {
  display: block;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.14);
}
.pv-online-dot {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--positive);
  box-shadow: 0 0 0 3px var(--surface-2);
}
.pv-ident-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.pv-ident-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-strong);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pv-ident-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 4px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pv-meta-dot {
  color: var(--faint);
}
.pv-balance {
  display: flex;
  flex-direction: column;
  margin: 2px 20px 0;
  padding: 14px 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
.pv-balance-label {
  margin-bottom: 7px;
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--faint);
}
.pv-balance-value {
  display: flex;
  align-items: baseline;
  gap: 4px;
  font-family: var(--font-mono);
  font-size: 21px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1;
  color: var(--text-strong);
}
.pv-balance-value small {
  font-size: 11px;
  font-weight: 500;
  color: var(--muted);
}
.pv-nav {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.pv-navitem {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 12px;
  background: transparent;
  border: 0;
  border-radius: var(--radius);
  color: var(--muted);
  font-size: 13.5px;
  text-align: left;
  cursor: pointer;
  transition: background var(--dur) var(--ease), color var(--dur) var(--ease),
    transform var(--dur) var(--ease);
}
.pv-navitem:hover {
  color: var(--text-strong);
  background: rgba(255, 255, 255, 0.03);
}
.pv-navitem:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.pv-navitem[aria-current="page"] {
  background: var(--accent-soft);
  color: var(--accent);
}
.pv-navitem svg {
  flex: none;
}
.pv-navlabel {
  flex: 1;
  min-width: 0;
}
.pv-navcount {
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--faint);
  background: rgba(255, 255, 255, 0.04);
  border-radius: 2px;
  padding: 1px 6px;
  min-width: 22px;
  text-align: center;
}
.pv-navitem[aria-current="page"] .pv-navcount {
  color: var(--accent);
  background: rgba(232, 161, 60, 0.12);
}
.pv-sidefoot {
  padding: 14px 16px;
  border-top: 1px solid var(--line);
}
.pv-main {
  min-height: 0;
  overflow-y: auto;
  background: var(--bg);
  scroll-behavior: smooth;
}
.pv-mobilebar {
  display: none;
}
.pv-head {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 26px 36px 0;
}
.pv-headtop {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.pv-crumb {
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--accent);
}
.pv-headaddr {
  display: flex;
  align-items: center;
  gap: 10px;
}
.pv-headtitle {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
}
.pv-title {
  font-family: var(--font-display);
  font-size: clamp(22px, 2.4vw, 30px);
  font-weight: 620;
  letter-spacing: -0.025em;
  color: var(--text-strong);
}
.pv-subtitle {
  font-size: 12.5px;
  color: var(--muted);
}
.pv-content {
  padding: 20px 36px 48px;
}
@keyframes pv-rise {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.pv-summary,
.pv-table-scroll,
.pv-collections {
  animation: pv-rise 260ms var(--ease) both;
}
@media (prefers-reduced-motion: reduce) {
  .pv-summary,
  .pv-table-scroll,
  .pv-collections {
    animation: none;
  }
}

/* --- Summary stat strip --------------------------------------------------- */
.pv-summary {
  display: flex;
  flex-direction: column;
  gap: 22px;
}
.pv-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: linear-gradient(150deg, var(--surface-2), var(--surface) 72%);
  overflow: hidden;
}
.pv-stat {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
  padding: 16px 20px;
  border-right: 1px solid var(--line);
  transition: background var(--dur) var(--ease);
}
.pv-stat:last-child {
  border-right: 0;
}
.pv-stat:hover {
  background: rgba(255, 255, 255, 0.02);
}
.pv-stat-label {
  font-family: var(--font-mono);
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--faint);
}
.pv-stat-value {
  display: flex;
  align-items: baseline;
  gap: 5px;
  font-size: 24px;
  line-height: 1.05;
  font-weight: 600;
  color: var(--text-strong);
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pv-stat-value small {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.06em;
  color: var(--muted);
}
.pv-stat-sub {
  font-size: 11.5px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pv-mono {
  font-family: var(--font-mono);
}

/* --- Two-column panels ---------------------------------------------------- */
.pv-overview {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  align-items: start;
}
.pv-panel {
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  overflow: hidden;
}
.pv-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 13px 18px;
  border-bottom: 1px solid var(--line);
}
.pv-panel-head h2 {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted);
}
.pv-panel-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: transparent;
  border: 0;
  padding: 0;
  font-size: 11.5px;
  color: var(--accent);
  cursor: pointer;
  transition: gap var(--dur) var(--ease);
}
.pv-panel-link:hover {
  gap: 8px;
}
.pv-panel-link svg {
  transition: transform var(--dur) var(--ease);
}
.pv-panel-link:hover svg {
  transform: translateX(2px);
}
.pv-panel-empty {
  padding: 20px 18px;
  font-size: 13px;
  color: var(--muted);
}
.pv-minilist {
  display: flex;
  flex-direction: column;
}
.pv-minirow {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto auto auto;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 18px;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--line);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: default;
  transition: background var(--dur) var(--ease);
}
.pv-minirow[role="button"] {
  cursor: pointer;
}
.pv-minirow[role="button"]:focus-visible,
.pv-minirow-link:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
.pv-minirow:last-child {
  border-bottom: 0;
}
.pv-minirow[role="button"]:hover,
.pv-minirow-link:hover {
  background: rgba(255, 255, 255, 0.025);
}
.pv-minirow-link {
  cursor: pointer;
  text-decoration: none;
}
.pv-mini-thumb {
  position: relative;
  display: block;
  width: 34px;
  height: 34px;
  border-radius: 7px;
  overflow: hidden;
  border: 1px solid var(--line);
  background: var(--surface-3);
}
.pv-mini-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.pv-mini-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-strong);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pv-mini-sub {
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pv-mini-price {
  font-size: 11.5px;
  color: var(--text);
}
.pv-mini-time {
  font-size: 11px;
  color: var(--faint);
  white-space: nowrap;
  text-align: right;
}

/* --- Assets preview ------------------------------------------------------- */
.pv-assets {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.pv-assets-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.pv-assets-head h2 {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted);
}
.pv-assets-count {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--faint);
}
.pv-assets-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 14px;
}
.pv-assetcard {
  display: flex;
  flex-direction: column;
  padding: 0;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
  text-align: left;
  cursor: pointer;
  transition: transform var(--dur) var(--ease), border-color var(--dur) var(--ease),
    box-shadow var(--dur) var(--ease);
}
.pv-assetcard:hover {
  transform: translateY(-2px);
  border-color: rgba(232, 161, 60, 0.26);
  box-shadow: var(--shadow-soft);
}
.pv-assetcard:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.pv-assetcard-media {
  position: relative;
  display: block;
  aspect-ratio: 1 / 1;
  background: var(--surface-3);
  overflow: hidden;
}
.pv-assetcard-media :global(img) {
  transition: transform 600ms var(--ease-lux);
}
.pv-assetcard:hover .pv-assetcard-media :global(img) {
  transform: scale(1.04);
}
.pv-assetcard-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px 12px 12px;
  min-width: 0;
}
.pv-assetcard-name {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text-strong);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pv-assetcard-price {
  font-size: 11.5px;
  color: var(--muted);
}

/* --- Collection cards ----------------------------------------------------- */
.pv-collections {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}
.pv-collcard {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  text-decoration: none;
  cursor: pointer;
  transition: transform var(--dur) var(--ease), border-color var(--dur) var(--ease),
    background var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
}
.pv-collcard:hover {
  transform: translateY(-2px);
  border-color: rgba(232, 161, 60, 0.24);
  background: var(--surface-2);
  box-shadow: var(--shadow-soft);
}
.pv-collcard:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.pv-collthumb {
  position: relative;
  display: block;
  width: 64px;
  height: 64px;
  flex: none;
  border-radius: var(--radius);
  overflow: hidden;
  border: 1px solid var(--line);
  background: var(--surface-3);
}
.pv-collthumb :global(img) {
  transition: transform 600ms var(--ease-lux);
}
.pv-collcard:hover .pv-collthumb :global(img) {
  transform: scale(1.05);
}
.pv-collbody {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
  flex: 1;
}
.pv-collname {
  font-family: var(--font-display);
  font-size: 16px;
  color: var(--text-strong);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pv-collmeta {
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pv-collview {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: none;
  font-size: 11.5px;
  color: var(--accent);
  transition: gap var(--dur) var(--ease);
}
.pv-collcard:hover .pv-collview {
  gap: 8px;
}

/* --- Tables --------------------------------------------------------------- */
.pv-table-scroll {
  width: 100%;
}
.pv-table {
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  overflow: hidden;
}
.pv-headrow,
.pv-row {
  display: grid;
  grid-template-columns: var(--pv-cols, 52px minmax(0, 1fr) 130px 130px 100px);
  gap: 14px;
  align-items: center;
  padding: 10px 18px;
}
.pv-headrow {
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.012);
}
.pv-th {
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--faint);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pv-row {
  border-bottom: 1px solid var(--line);
  transition: background var(--dur) var(--ease);
}
.pv-row:last-child {
  border-bottom: 0;
}
.pv-row[data-clickable="true"] {
  cursor: pointer;
}
.pv-row[data-clickable="true"]:hover {
  background: rgba(255, 255, 255, 0.022);
}
.pv-row[data-clickable="true"]:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
.pv-row .btn {
  cursor: pointer;
}
.pv-assetcell {
  grid-column: 1 / 2;
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  min-width: 0;
}
.pv-thumb {
  position: relative;
  display: block;
  width: 44px;
  height: 44px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--line);
  background: var(--surface-3);
}
.pv-name {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.pv-name-main {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text-strong);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pv-name-sub {
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pv-cell {
  min-width: 0;
  font-size: 12.5px;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pv-cell.pv-muted {
  color: var(--muted);
}
.pv-action {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  text-align: right;
}
.pv-view {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  color: var(--accent);
}
.pv-explorer {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--muted);
  text-decoration: none;
  transition: color var(--dur) var(--ease);
}
.pv-explorer:hover {
  color: var(--accent);
}
.pv-status {
  display: inline-flex;
  align-items: center;
  font-size: 11.5px;
  color: var(--muted);
}
.pv-status[data-status="active"] {
  color: var(--positive);
}
.pv-event {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text);
}
.pv-event::before {
  content: "";
  width: 7px;
  height: 7px;
  border-radius: 2px;
  background: var(--faint);
  flex: none;
}
.pv-event[data-kind="sale"]::before {
  background: var(--positive);
}
.pv-event[data-kind="list"]::before {
  background: var(--accent);
}
.pv-event[data-kind="cancel"]::before {
  background: var(--negative, #d96a5a);
}
.pv-event[data-kind="transfer"]::before {
  background: var(--faint);
}
.pv-kind {
  position: absolute;
  left: 4px;
  bottom: 4px;
  width: 9px;
  height: 9px;
  border-radius: 3px;
  background: var(--faint);
  box-shadow: 0 0 0 2px rgba(10, 9, 7, 0.72);
}
.pv-kind[data-kind="sale"] {
  background: var(--positive);
}
.pv-kind[data-kind="list"] {
  background: var(--accent);
}
.pv-kind[data-kind="cancel"] {
  background: var(--negative, #d96a5a);
}
.pv-kind[data-kind="transfer"] {
  background: var(--faint);
}

/* --- Connect state -------------------------------------------------------- */
.pv-connect {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - var(--mk-chrome-top));
  padding: 40px 24px;
}
.pv-connect-card {
  width: 100%;
  max-width: 520px;
}
.pv-connect-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
  margin-top: 8px;
}
@media (max-width: 1100px) {
  .pv-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .pv-stat:nth-child(2) {
    border-right: 0;
  }
  .pv-stat:nth-child(1),
  .pv-stat:nth-child(2) {
    border-bottom: 1px solid var(--line);
  }
}
@media (max-width: 900px) {
  .pv-root {
    grid-template-columns: minmax(0, 1fr);
    height: auto;
    min-height: 0;
  }
  .pv-sidebar {
    display: none;
  }
  .pv-mobilebar {
    display: flex;
    align-items: center;
    gap: 8px;
    position: sticky;
    top: var(--mk-header-height);
    z-index: 5;
    padding: 10px 14px;
    background: var(--surface-2);
    border-bottom: 1px solid var(--line);
  }
  .pv-mobilenav {
    display: flex;
    gap: 6px;
    flex: 1;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .pv-mobilenav::-webkit-scrollbar {
    display: none;
  }
  .pv-mobilenav .pv-navitem {
    width: auto;
    white-space: nowrap;
    padding: 8px 12px;
  }
  .pv-head {
    padding: 20px 16px 0;
  }
  .pv-content {
    padding: 18px 16px 40px;
  }
  .pv-overview {
    grid-template-columns: minmax(0, 1fr);
  }
  .pv-table-scroll {
    overflow-x: auto;
  }
  .pv-table {
    min-width: 640px;
  }
}
`}</style>
  );
}
