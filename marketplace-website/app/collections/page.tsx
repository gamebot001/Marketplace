import type { Metadata } from "next";
import { CollectionsBrowser } from "@/components/marketplace/collections-browser";

export const metadata: Metadata = {
  title: "Collections",
  description:
    "Discover verified Solana collections on the Zecians Marketplace — explore their work and find the projects you want to follow, collect, or learn more about.",
};

export default function CollectionsPage() {
  return (
    <div className="coll-index">
      <div className="container coll-index-body">
        <CollectionsBrowser />
      </div>
    </div>
  );
}
