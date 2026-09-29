import type { Metadata } from "next";
import Reveal, { MaskLines } from "@/components/reveal";
import MarketplaceCta from "@/components/marketplace-cta";

export const metadata: Metadata = {
  title: "About",
  description:
    "What Zecians is — a premium digital culture and ownership brand — and how the brand website relates to the marketplace application.",
};

const PRINCIPLES = [
  {
    title: "Identity first",
    copy: "The collection is a signal, not a statistic. Who you are on-chain matters more than what any single asset is worth.",
  },
  {
    title: "Ownership is proven",
    copy: "Every Zecian lives on Solana. Ownership is verifiable, portable and permanent — not a promise on a dashboard.",
  },
  {
    title: "Culture over hype",
    copy: "Trends move; communities remain. Zecians is built for the people who intend to stay.",
  },
];

export default function AboutPage() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <Reveal className="section-label-row">
            <span className="section-label">About</span>
          </Reveal>
          <MaskLines
            as="h1"
            lines={[<>A brand, not just</>, <>a collection.</>]}
          />
          <Reveal as="p" className="page-lede" delay={0.2}>
            Zecians is a digital culture and ownership brand — art, identity and
            community carried on Solana.
          </Reveal>
        </div>
      </section>

      <section className="section" aria-label="About Zecians">
        <div className="container">
          <div className="prose" style={{ paddingTop: 0, paddingBottom: 0 }}>
            <Reveal as="p">
              <strong>Zecians</strong> exists for people who treat digital
              ownership as more than a position. A Zecian is a mark of
              belonging — a way of appearing on-chain that says something about
              the person holding it.
            </Reveal>
            <Reveal as="p">
              The brand is intentionally small and intentional in what it
              makes: original artwork, a durable identity, and a marketplace
              where the collection changes hands without ever losing its
              meaning.
            </Reveal>
          </div>

          <Reveal className="principles">
            {PRINCIPLES.map((principle, i) => (
              <article className="principle" key={principle.title}>
                <span className="principle-num" aria-hidden="true">
                  0{i + 1}
                </span>
                <div>
                  <h2 className="principle-title">{principle.title}</h2>
                  <p className="principle-copy">{principle.copy}</p>
                </div>
              </article>
            ))}
          </Reveal>

          <div className="about-split">
            <Reveal className="about-panel is-active">
              <p className="about-panel-role">You are here</p>
              <h2 className="about-panel-title">The Brand Website</h2>
              <p className="about-panel-copy">
                Identity, positioning and experience. This site is the entrance
                to Zecians — who we are, what the collection represents, and
                where the story begins.
              </p>
            </Reveal>
            <Reveal className="about-panel" delay={0.1}>
              <p className="about-panel-role">The Product</p>
              <h2 className="about-panel-title">The Marketplace</h2>
              <p className="about-panel-copy">
                A separate application for browsing collections, exploring
                listings and trading. The brand site never shows market data —
                that experience lives entirely in the marketplace.
              </p>
            </Reveal>
          </div>

          <Reveal className="entry-actions" delay={0.15}>
            <MarketplaceCta size="lg" />
          </Reveal>
        </div>
      </section>
    </>
  );
}
