"use client";

/**
 * Real marketplace search results — rendered inside the centered command
 * panel. Uses the live API hooks; nothing is fabricated: an empty query
 * shows real suggested collections, an unmatched query shows an honest
 * empty state.
 */

import { useMemo } from "react";
import Link from "next/link";
import { ArrowUpRight, BadgeCheck } from "lucide-react";
import { useCollections, useListingsWithAssets } from "@/lib/api/hooks";
import { buildListingViews } from "@/lib/marketplace/views";
import { formatSol } from "@/lib/format";
import { Artwork } from "@/components/ui/artwork";
import { LineSkeleton } from "@/components/ui/skeleton";

export function SearchResults({ query }: { query: string }) {
  const trimmed = query.trim().toLowerCase();
  const collectionsState = useCollections();
  const listingsState = useListingsWithAssets({ status: "active" });

  const views = useMemo(
    () =>
      buildListingViews(
        listingsState.data?.listings ?? [],
        listingsState.data?.assets ?? {},
        listingsState.data?.collections ?? []
      ),
    [listingsState.data]
  );

  const assetHits = useMemo(() => {
    if (trimmed.length < 2) return [];
    return views
      .filter(
        (v) =>
          v.name.toLowerCase().includes(trimmed) ||
          v.collectionName.toLowerCase().includes(trimmed) ||
          v.listing.asset_address.toLowerCase().includes(trimmed)
      )
      .slice(0, 5);
  }, [views, trimmed]);

  const collectionHits = useMemo(() => {
    if (trimmed.length < 2) return [];
    return (collectionsState.data ?? [])
      .filter(
        (c) =>
          c.name.toLowerCase().includes(trimmed) ||
          (c.description ?? "").toLowerCase().includes(trimmed) ||
          (c.collection_address ?? "").toLowerCase().includes(trimmed)
      )
      .slice(0, 3);
  }, [collectionsState.data, trimmed]);

  /* Empty query — real suggested collections, newest flagship first. */
  const suggested = useMemo(
    () =>
      trimmed.length < 2
        ? [...(collectionsState.data ?? [])]
            .sort((a, b) => Number(b.flagship) - Number(a.flagship))
            .slice(0, 4)
        : [],
    [collectionsState.data, trimmed]
  );

  const loading =
    trimmed.length >= 2 && (collectionsState.loading || listingsState.loading);

  if (trimmed.length < 2) {
    return (
      <div className="cmd-section">
        <span className="cmd-section-label">Suggested</span>
        <div className="cmd-list">
          {suggested.map((c) => (
            <Link
              key={c.slug}
              href={`/collections/${c.slug}`}
              className="cmd-row"
            >
              <span className="cmd-thumb">
                {c.image ? (
                  <Artwork src={c.image} alt="" sizes="44px" />
                ) : (
                  <span className="cmd-thumb-fallback" aria-hidden />
                )}
              </span>
              <span className="cmd-rowmeta">
                <span className="cmd-rowname">
                  {c.name}
                  {c.verification_status === "verified" && (
                    <BadgeCheck
                      size={14}
                      strokeWidth={2.4}
                      style={{ color: "var(--accent)" }}
                      aria-label="Verified collection"
                    />
                  )}
                </span>
                <span className="cmd-rowsub">Collection</span>
              </span>
              <span className="cmd-rowarrow" aria-hidden>
                <ArrowUpRight size={14} />
              </span>
            </Link>
          ))}
          <Link href="/collections" className="cmd-row cmd-row-more">
            Browse all collections
            <ArrowUpRight size={13} aria-hidden />
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="search-results" aria-busy="true">
        <LineSkeleton width="62%" />
        <LineSkeleton width="44%" />
        <LineSkeleton width="53%" />
      </div>
    );
  }

  const anyHits = assetHits.length > 0 || collectionHits.length > 0;

  if (!anyHits) {
    return (
      <div className="cmd-empty">No results found for “{query.trim()}”.</div>
    );
  }

  return (
    <div className="cmd-scroll">
      {collectionHits.length > 0 && (
        <div className="cmd-section">
          <span className="cmd-section-label">Collections</span>
          <div className="cmd-list">
            {collectionHits.map((c) => (
              <Link
                key={c.slug}
                href={`/collections/${c.slug}`}
                className="cmd-row"
              >
                <span className="cmd-thumb">
                  {c.image ? (
                    <Artwork src={c.image} alt="" sizes="44px" />
                  ) : (
                    <span className="cmd-thumb-fallback" aria-hidden />
                  )}
                </span>
                <span className="cmd-rowmeta">
                  <span className="cmd-rowname">
                    {c.name}
                    {c.verification_status === "verified" && (
                      <BadgeCheck
                        size={14}
                        strokeWidth={2.4}
                        style={{ color: "var(--accent)" }}
                        aria-label="Verified collection"
                      />
                    )}
                  </span>
                  <span className="cmd-rowsub">Collection · {c.standard}</span>
                </span>
                <span className="cmd-rowarrow" aria-hidden>
                  <ArrowUpRight size={14} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {assetHits.length > 0 && (
        <div className="cmd-section">
          <span className="cmd-section-label">NFTs</span>
          <div className="cmd-list">
            {assetHits.map((v) => (
              <Link
                key={v.listing.listing_id}
                href={`/nft/${v.listing.asset_address}`}
                className="cmd-row"
              >
                <span className="cmd-thumb">
                  <Artwork src={v.image} alt="" sizes="44px" />
                </span>
                <span className="cmd-rowmeta">
                  <span className="cmd-rowname">{v.name}</span>
                  <span className="cmd-rowsub">{v.collectionName}</span>
                </span>
                <span className="cmd-rowprice mono">
                  {formatSol(v.listing.price_lamports)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <Link
        href={`/explore?q=${encodeURIComponent(query.trim())}`}
        className="cmd-row cmd-row-more"
      >
        View all results
        <ArrowUpRight size={13} aria-hidden />
      </Link>
    </div>
  );
}
