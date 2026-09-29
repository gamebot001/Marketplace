import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms",
  description: "Terms of use for the Zecians Marketplace.",
};

export default function TermsPage() {
  return (
    <>
      <div className="page-head">
        <div className="container">
          <div className="eyebrow">Terms</div>
          <h1>Terms of use.</h1>
          <p className="lede">
            The plain terms that govern use of the Zecians Marketplace while it
            operates in development.
          </p>
        </div>
      </div>

      <section className="section">
        <div className="container-narrow prose">
          <h2>Development network</h2>
          <p>
            The marketplace runs on Solana Devnet. All assets, prices and
            balances are test values with no monetary worth. Nothing on this
            site constitutes financial advice or an offer of any kind.
          </p>
          <h2>Fees &amp; royalties</h2>
          <p>
            Marketplace fees and applicable royalty flows are handled according
            to the marketplace and collection rules. Fee percentages are shown
            exactly as configured on the network &amp; fees page. No token
            rewards are offered, promised, or implied.
          </p>
          <h2>Your wallet</h2>
          <p>
            Connecting a wallet grants the interface read access to your public
            address. Zecians never asks for a seed phrase or private key, and
            never takes custody of assets. Transactions are proposed for your
            explicit approval in your own wallet.
          </p>
          <h2>No warranty</h2>
          <p>
            The service is provided as-is during development, without warranty
            of any kind. On-chain transactions are irreversible; review every
            transaction before approving it.
          </p>
        </div>
      </section>
    </>
  );
}
