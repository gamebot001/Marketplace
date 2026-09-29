"use client";

/**
 * All collections — flagship presented as a strong horizontal card, the rest
 * as a refined grid. Real registrations only; honest empty state otherwise.
 */

import Link from "next/link";
import { BadgeCheck, ChevronRight, Layers } from "lucide-react";
import { useCollections, useListings } from "@/lib/api/hooks";
import { FeaturedCollectionCard } from "@/components/marketplace/featured-collections";
import { Artwork } from "@/components/ui/artwork";
import { Reveal } from "@/components/ui/motion";
import { CardSkeletons } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { resolveImageUrl, formatSol } from "@/lib/format";
import { DEMO_MODE, demoCollectionStats } from "@/lib/demo-marketplace-data";

export function CollectionsBrowser() {
  const { data, error, loading } = useCollections();
  const listings = useListings({ status: "active" });
  const collections = data ?? [];

  if (loading) return <CardSkeletons count={4} />;
  if (error) return <ErrorState title="Could not load collections" message={error} />;
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

  const liveByAddress = new Map<string, number>();
  for (const listing of listings.data ?? []) {
    const key = listing.collection_address ?? "";
    if (key) liveByAddress.set(key, (liveByAddress.get(key) ?? 0) + 1);
  }
  const listingsFor = (address: string | null) =>
    address ? (liveByAddress.get(address) ?? 0) : 0;

  const featured = collections.find((c) => c.flagship) ?? collections[0];
  const secondary = collections.filter((c) => c !== featured);
  const featuredStats = DEMO_MODE ? demoCollectionStats(featured.slug) : null;

  return (
    <div style={{ display: "grid", gap: 32 }}>
      <Reveal>
        <FeaturedCollectionCard
          collection={featured}
          activeListings={listingsFor(featured.collection_address)}
          stats={featuredStats}
          index={0}
        />
      </Reveal>

      {secondary.length > 0 && (
        <div className="grid grid-4">
          {secondary.map((collection, i) => {
            const verified = collection.verification_status === "verified";
            const live = listingsFor(collection.collection_address);
            const stats = DEMO_MODE ? demoCollectionStats(collection.slug) : null;
            return (
              <Reveal key={collection.slug} delay={(i % 4) * 80}>
                <Link
                  href={`/collections/${collection.slug}`}
                  className="rail-card"
                  style={{ height: "100%" }}
                  aria-label={`View collection ${collection.name}`}
                >
                  <div className="rail-media">
                    <Artwork
                      src={resolveImageUrl(collection.image)}
                      alt={collection.name}
                      sizes="(max-width: 560px) 100vw, (max-width: 1080px) 33vw, 25vw"
                    />
                    {stats && (
                      <span className="rail-floor">
                        Floor {formatSol(stats.floorLamports)}
                      </span>
                    )}
                  </div>
                  <div className="rail-body">
                    <h3>
                      <span className="rn">{collection.name}</span>
                      {verified && (
                        <BadgeCheck
                          size={14}
                          style={{ color: "var(--accent)", flex: "none" }}
                          aria-label="Verified"
                        />
                      )}
                    </h3>
                    <span className="rail-sub">
                      {stats
                        ? `Vol ${formatSol(stats.volumeLamports)} · ${stats.sales24h} sales today`
                        : `${verified ? "Verified" : "Unverified"} · ${collection.standard}`}
                    </span>
                    <div className="rail-foot">
                      <span
                        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                      >
                        <Layers size={12} style={{ color: "var(--accent)" }} />
                        <span className="mono">{live}</span> live
                      </span>
                      <ChevronRight size={13} aria-hidden />
                    </div>
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
      )}
    </div>
  );
}
