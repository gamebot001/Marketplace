import type { Metadata } from "next";
import { Layers, ShieldCheck, BadgeCheck, Coins } from "lucide-react";
import { CreatorForm } from "@/components/marketplace/creator-form";

export const metadata: Metadata = {
  title: "Create",
  description: "Bring your collection to the Zecians Marketplace.",
};

const POINTS = [
  {
    icon: Layers,
    title: "Multi-collection by design",
    body: "The marketplace is built around asset and collection addresses. Zecians is one collection among many — new projects plug in without special-casing.",
  },
  {
    icon: BadgeCheck,
    title: "Verification, not assumption",
    body: "Collections carry an explicit verification status. Verified marks are only shown when the platform has actually verified the collection.",
  },
  {
    icon: Coins,
    title: "Configurable fees & royalties",
    body: "Marketplace fees and configured secondary-sale royalties follow the marketplace and collection fee rules. All amounts are settled in integer lamports.",
  },
  {
    icon: ShieldCheck,
    title: "Devnet first",
    body: "Onboarding runs on Solana Devnet while development is active. Mainnet is disabled until an explicit launch phase.",
  },
];

export default function CreatePage() {
  return (
    <>
      <div className="page-head">
        <div className="container">
          <div className="eyebrow">Create</div>
          <h1>Bring your collection to Zecians Marketplace.</h1>
          <p className="lede">
            A generic, verification-first marketplace for Solana collections.
            This is an early surface — the creator launchpad is not complete, and
            applications are not yet being processed.
          </p>
        </div>
      </div>

      <section className="section">
        <div className="container">
          <div className="grid grid-2" style={{ gap: 28 }}>
            <div style={{ display: "grid", gap: 22 }}>
              {POINTS.map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="panel panel-pad"
                  style={{ display: "flex", gap: 16 }}
                >
                  <Icon size={20} style={{ color: "var(--accent)", flex: "none", marginTop: 2 }} />
                  <div>
                    <h3
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 19,
                        fontWeight: 400,
                        color: "var(--text-strong)",
                        marginBottom: 6,
                      }}
                    >
                      {title}
                    </h3>
                    <p style={{ color: "var(--muted)", fontSize: 13.5 }}>{body}</p>
                  </div>
                </div>
              ))}
            </div>

            <div id="apply">
              <div className="eyebrow" style={{ marginBottom: 14 }}>
                Project application
              </div>
              <CreatorForm />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
