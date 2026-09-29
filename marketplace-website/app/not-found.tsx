import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container" style={{ paddingTop: 90, paddingBottom: 90 }}>
      <div className="eyebrow" style={{ marginBottom: 16 }}>
        404
      </div>
      <h1 className="display display-lg" style={{ marginBottom: 20 }}>
        This page is not on the market.
      </h1>
      <p className="lede" style={{ marginBottom: 30 }}>
        The page you requested does not exist or has moved.
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link href="/" className="btn btn-primary">
          Back home
        </Link>
        <Link href="/explore" className="btn btn-outline">
          Explore listings
        </Link>
      </div>
    </div>
  );
}
