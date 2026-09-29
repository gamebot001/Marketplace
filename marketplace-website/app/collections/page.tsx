import type { Metadata } from "next";
import { CollectionsBrowser } from "@/components/marketplace/collections-browser";

export const metadata: Metadata = {
  title: "Collections",
  description: "Verified Solana collections registered on the Zecians Marketplace.",
};

export default function CollectionsPage() {
  return (
    <>
      <div className="page-head">
        <div className="container">
          <div className="eyebrow">Collections</div>
          <h1>Projects on the platform.</h1>
          <p className="lede">
            Each collection is registered, verifiable, and addressed on-chain.
            Zecians is one collection among many.
          </p>
        </div>
      </div>
      <div className="container" style={{ paddingTop: 34, paddingBottom: 40 }}>
        <CollectionsBrowser />
      </div>
    </>
  );
}
