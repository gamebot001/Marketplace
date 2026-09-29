"use client";

import { Artwork } from "@/components/ui/artwork";
import { VerifiedBadge } from "@/components/ui/badges";

/** Shared identity block at the top of every transaction review. */
export function FlowSummary({
  image,
  name,
  collection,
  verified,
}: {
  image: string | null;
  name: string;
  collection?: string | null;
  verified?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        alignItems: "center",
        paddingBottom: 18,
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div
        style={{
          position: "relative",
          width: 64,
          height: 64,
          flex: "none",
          borderRadius: 3,
          overflow: "hidden",
          border: "1px solid var(--line)",
          background: "var(--surface-3)",
        }}
      >
        <Artwork src={image} alt={name} sizes="64px" />
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            color: "var(--text-strong)",
            fontSize: 15,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </div>
        {collection && (
          <div
            className="nft-sub"
            style={{ marginTop: 4, minWidth: 0 }}
          >
            <span>{collection}</span>
            {verified && <VerifiedBadge label="" />}
          </div>
        )}
      </div>
    </div>
  );
}
