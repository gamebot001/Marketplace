"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Honest error surface for the collection detail route: when the backend read
 * model cannot be reached we show the real failure, never a fabricated page.
 */
export default function CollectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the real error in the console for debugging without hiding it.
    console.error(error);
  }, [error]);

  return (
    <div className="container" style={{ padding: "96px 0", textAlign: "center" }}>
      <div className="eyebrow">Collection</div>
      <h1 style={{ margin: "10px 0 6px" }}>This collection could not be loaded.</h1>
      <p className="lede" style={{ margin: "0 auto", maxWidth: 560 }}>
        The marketplace API did not respond, so no collection data was shown.
        Nothing here is placeholder or demo content.
      </p>
      <div
        style={{
          display: "flex",
          gap: 12,
          justifyContent: "center",
          marginTop: 22,
        }}
      >
        <button type="button" className="btn btn-primary" onClick={() => reset()}>
          Try again
        </button>
        <Link href="/collections" className="btn btn-outline">
          All collections
        </Link>
      </div>
    </div>
  );
}
