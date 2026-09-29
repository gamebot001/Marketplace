import { Suspense } from "react";
import type { Metadata } from "next";
import { ExploreBrowser } from "@/components/marketplace/explore-browser";
import { CardSkeletons } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Explore",
  description: "Discover and filter active listings across verified Solana collections.",
};

export default function ExplorePage() {
  return (
    <>
      <div className="page-head">
        <div className="container">
          <div className="eyebrow">Explore</div>
          <h1>Every listing, one surface.</h1>
          <p className="lede">
            Search across collections and filter active listings by price and
            verification status.
          </p>
        </div>
      </div>
      <Suspense
        fallback={
          <div className="container" style={{ paddingTop: 28 }}>
            <CardSkeletons count={8} />
          </div>
        }
      >
        <ExploreBrowser />
      </Suspense>
    </>
  );
}
