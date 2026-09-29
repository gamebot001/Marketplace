import type { Metadata } from "next";
import Reveal, { MaskLines } from "@/components/reveal";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How the Zecians main website handles data and privacy.",
};

export default function PrivacyPage() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <Reveal className="section-label-row">
            <span className="section-label">Legal</span>
          </Reveal>
          <MaskLines as="h1" lines={[<>Privacy.</>]} />
          <Reveal as="p" className="page-lede" delay={0.2}>
            The Zecians brand website is designed to be experienced without
            collecting you.
          </Reveal>
        </div>
      </section>

      <section className="section" aria-label="Privacy policy">
        <div className="container">
          <div className="prose" style={{ paddingTop: 0 }}>
            <Reveal as="p" className="prose-updated">
              Last updated — September 2026
            </Reveal>
            <Reveal as="p">
              This policy covers the <strong>Zecians main brand website</strong>{" "}
              only. The Zecians Marketplace is a separate application with its
              own privacy practices, available within that product.
            </Reveal>

            <h2>What we collect</h2>
            <p>
              The brand website does not require an account, a wallet
              connection or any personal information to browse. We do not buy,
              sell or broker personal data.
            </p>

            <h2>Local technical data</h2>
            <p>
              Like most websites, standard technical logs (such as IP address,
              browser type and pages requested) may be processed for security,
              reliability and abuse prevention. This site does not use
              advertising trackers or cross-site profiling.
            </p>

            <h2>Wallets and the blockchain</h2>
            <p>
              This website never asks you to connect a wallet. Blockchain data
              — including ownership of any Zecians asset — is public by nature
              of Solana. Interactions that do involve wallets happen in the
              marketplace application, under its own terms.
            </p>

            <h2>Development networks</h2>
            <p>
              While Zecians operates on development networks, everything shown
              is experimental and uses test SOL with no real-world value.
            </p>

            <h2>Changes</h2>
            <p>
              If this policy changes materially, the updated version will be
              published on this page with a new revision date.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
