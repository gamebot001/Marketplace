import Link from "next/link";
import { Artwork } from "@/components/ui/artwork";
import { VerifiedBadge } from "@/components/ui/badges";
import { resolveImageUrl } from "@/lib/format";
import type { MarketplaceCollection } from "@/lib/api/types";

/** Collection card used on /collections and the homepage. */
export function CollectionCard({
  collection,
}: {
  collection: MarketplaceCollection;
}) {
  const verified = collection.verification_status === "verified";
  return (
    <Link href={`/collections/${collection.slug}`} className="collection-card">
      <div className="collection-thumb" style={{ position: "relative" }}>
        <Artwork
          src={resolveImageUrl(collection.image)}
          alt={collection.name}
          sizes="84px"
        />
      </div>
      <div className="collection-info">
        <h3>
          {collection.name}
          {verified && <VerifiedBadge label="" />}
        </h3>
        <p>{collection.description || "No description provided."}</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span className="badge">{collection.standard}</span>
          {collection.flagship && <span className="badge badge-gold">Flagship</span>}
        </div>
      </div>
    </Link>
  );
}
