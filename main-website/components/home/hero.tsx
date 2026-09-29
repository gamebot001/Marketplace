import MarketplaceCta from "@/components/marketplace-cta";
import { ArrowRight } from "@/components/arrows";

/**
 * Opening screen. The intro sequence is pure CSS: dark veil lifts, the
 * wordmark context is already live, headline lines rise out of masks, then
 * the supporting line and CTAs settle in. The user reaches the hero in
 * well under two seconds — this is an entrance, not a loading screen.
 */
export default function Hero() {
  return (
    <section className="hero" aria-label="Zecians — a community of believers">
      <div className="intro-veil" aria-hidden="true" />

      <div className="container hero-inner">
        <div className="hero-copy">
          <p className="hero-eyebrow">A digital culture brand</p>

          <h1 className="h-hero">
            <span className="mask">
              <span className="mask-line">More than holders.</span>
            </span>
            <span className="mask">
              <span className="mask-line">
                A community of <em className="hero-accent">believers</em>.
              </span>
            </span>
          </h1>

          <p className="hero-sub">
            Zecians is identity, ownership and culture on Solana — a collection
            carried by people who build, collect and show up.
          </p>

          <div className="hero-actions">
            <MarketplaceCta size="lg" />
            <a href="#identity" className="cta cta-ghost cta-lg">
              Explore Zecians
              <ArrowRight />
            </a>
          </div>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="hv-stage">
            <span className="hv-z">Z</span>
            <div className="hv-line hv-line-1" />
            <div className="hv-line hv-line-2" />
            <div className="hv-ring hv-ring-2" />
            <div className="hv-ring" />
            <div className="hv-arc" />
            <div className="hv-core" />
            <span className="hv-meta hv-meta-1">Zec — 001</span>
            <span className="hv-meta hv-meta-2">Identity · Ownership</span>
          </div>
        </div>
      </div>

      <div className="container hero-foot">
        <span className="hero-scroll">Scroll</span>
        <span className="hero-foot-note">Solana — Digital Culture</span>
      </div>
    </section>
  );
}
