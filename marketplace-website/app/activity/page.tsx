import type { Metadata } from "next";
import { ActivityTable } from "@/components/marketplace/activity-table";
import { DEMO_MODE } from "@/lib/demo-marketplace-data";

export const metadata: Metadata = {
  title: "Activity",
  description: "Marketplace activity observed on Solana Devnet.",
};

export default function ActivityPage() {
  return (
    <>
      <div className="page-head">
        <div className="container">
          <div className="eyebrow">Activity</div>
          <h1>{DEMO_MODE ? "Demo market activity." : "What the chain recorded."}</h1>
          <p className="lede">
            {DEMO_MODE
              ? "Preview events from the local demo dataset — sales, listings and transfers rendered for design review."
              : "Mints, listings, sales and transfers — indexed from real observed transactions, never simulated."}
          </p>
        </div>
      </div>
      <div className="container" style={{ paddingTop: 34, paddingBottom: 40 }}>
        <ActivityTable />
      </div>
    </>
  );
}
