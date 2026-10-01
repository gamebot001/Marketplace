import { Suspense } from "react";
import type { Metadata } from "next";
import { ExploreBrowser } from "@/components/marketplace/explore-browser";
import { CardSkeletons } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Explore",
  description:
    "The global NFT discovery hub — search and filter every listing across verified Solana collections.",
};

export default function ExplorePage() {
  return (
    <>
      <div className="page-head">
        <div className="container">
          <div className="eyebrow">Explore</div>
          <h1>Discover the whole marketplace.</h1>
          <p className="lede">
            The complete cross-collection surface. Search every listing, narrow
            by collection, status, price range or trait, and sort the way you
            want — where the homepage curates and a collection page stays
            focused on one project, Explore shows it all.
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
