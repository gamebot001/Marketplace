import type { Metadata } from "next";
import { SettingsView } from "@/components/marketplace/settings-view";

export const metadata: Metadata = {
  title: "Settings",
  description: "Network, fees and treasury information for the Zecians Marketplace.",
};

export default function SettingsPage() {
  return (
    <>
      <div className="page-head">
        <div className="container">
          <div className="eyebrow">Settings</div>
          <h1>Network, fees &amp; treasury.</h1>
          <p className="lede">
            Live configuration as reported by the platform API. Nothing here is
            estimated or promised.
          </p>
        </div>
      </div>
      <div className="container" style={{ paddingTop: 34, paddingBottom: 40 }}>
        <SettingsView />
      </div>
    </>
  );
}
