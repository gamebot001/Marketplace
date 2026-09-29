import MarketplaceCta from "@/components/marketplace-cta";
import Reveal, { MaskLines } from "@/components/reveal";

/**
 * The gateway. Brand website above, marketplace product beyond this point —
 * the CTA navigates to the separate application.
 */
export default function MarketEntry() {
  return (
    <section className="entry section" aria-label="Enter the marketplace">
      <div className="container entry-frame">
        <Reveal className="section-label-row" >
          <span className="section-label">The Marketplace</span>
        </Reveal>

        <MaskLines
          as="h2"
          className="entry-h"
          lines={[
            <>
              Enter the mark<span className="entry-dot">.</span>
            </>,
          ]}
        />

        <Reveal as="p" className="entry-sub" delay={0.18}>
          Discover what&rsquo;s being collected.
        </Reveal>

        <Reveal className="entry-actions" delay={0.26}>
          <MarketplaceCta size="xl" />
        </Reveal>

        <Reveal as="p" className="entry-meta" delay={0.34}>
          Opens the Zecians Marketplace — a separate application
        </Reveal>
      </div>
    </section>
  );
}
