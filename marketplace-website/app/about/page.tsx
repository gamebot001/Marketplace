import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About",
  description: "What Zecians Marketplace is and how it works.",
};

export default function AboutPage() {
  return (
    <>
      <div className="page-head">
        <div className="container">
          <div className="eyebrow">About</div>
          <h1>A market built on verification.</h1>
          <p className="lede">
            Zecians Marketplace is a multi-collection marketplace for digital
            assets on Solana. It is a separate product from the Zecians NFT
            collection — one platform, many collections.
          </p>
        </div>
      </div>

      <section className="section">
        <div className="container-narrow prose">
          <p>
            The marketplace is collection-agnostic by design. Assets and
            collections are identified by their on-chain addresses, and the
            interface only presents what the indexer has actually observed:
            real listings, real sales, real ownership.
          </p>
          <h2>Principles</h2>
          <p>
            <strong style={{ color: "var(--text-strong)" }}>Verification over assumption.</strong>{" "}
            Collections carry an explicit verification status. A verified mark
            appears only when the platform has verified the collection.
          </p>
          <p>
            <strong style={{ color: "var(--text-strong)" }}>Honesty over decoration.</strong>{" "}
            If the market has no listings yet, the interface says so. Nothing
            is simulated — no fake volume, no invented activity, no
            placeholders posing as data.
          </p>
          <p>
            <strong style={{ color: "var(--text-strong)" }}>Settlement on-chain.</strong>{" "}
            Prices, fees and configured royalties follow the marketplace and
            collection rules, settled in integer lamports. Every transaction
            links to the Solana Explorer on the configured cluster.
          </p>
          <h2>Development status</h2>
          <p>
            The platform currently runs on Solana Devnet with test SOL only.
            Mainnet is deliberately disabled until an explicit launch phase.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 28 }}>
            <Link href="/explore" className="btn btn-primary">
              Explore the market
            </Link>
            <Link href="/create" className="btn btn-outline">
              Bring your collection
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
