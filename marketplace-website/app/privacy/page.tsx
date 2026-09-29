import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How the Zecians Marketplace handles data.",
};

export default function PrivacyPage() {
  return (
    <>
      <div className="page-head">
        <div className="container">
          <div className="eyebrow">Privacy</div>
          <h1>Data, minimised.</h1>
          <p className="lede">
            What the marketplace sees, stores, and does not.
          </p>
        </div>
      </div>

      <section className="section">
        <div className="container-narrow prose">
          <h2>What is processed</h2>
          <p>
            When you connect a wallet, the interface reads your public wallet
            address to show your profile, listings and activity. Public
            blockchain data — addresses, signatures, transactions — is indexed
            from the configured Solana cluster and is inherently public.
          </p>
          <h2>What is never requested</h2>
          <p>
            Zecians never asks for a seed phrase, private key, or any personal
            identity information. There are no accounts, emails, or passwords
            on this platform.
          </p>
          <h2>What is stored</h2>
          <p>
            Wallet connection state is kept locally by your wallet extension
            and this browser session. No personal data is sold, shared, or
            used for advertising.
          </p>
          <h2>Questions</h2>
          <p>
            For any privacy question relating to the marketplace platform,
            reach the Zecians team through official platform channels.
          </p>
        </div>
      </section>
    </>
  );
}
