import Link from "next/link";
import { IS_DEV_CHAIN, MARKETPLACE_URL, NETWORK_LABEL } from "@/lib/config";
import { ArrowRight } from "@/components/arrows";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <p className="footer-brand-word">Zecians</p>
            <p className="footer-tagline">
              Digital identity, ownership and culture — held by the people who
              believe in it.
            </p>
          </div>

          <nav aria-label="Explore">
            <p className="footer-col-title">Explore</p>
            <div className="footer-links">
              <Link href="/#identity" className="footer-link">
                Explore Zecians
              </Link>
              <a href={MARKETPLACE_URL} className="footer-link" rel="noreferrer">
                Marketplace
                <ArrowRight />
              </a>
              <Link href="/about" className="footer-link">
                About
              </Link>
            </div>
          </nav>

          <nav aria-label="Legal">
            <p className="footer-col-title">Legal</p>
            <div className="footer-links">
              <Link href="/terms" className="footer-link">
                Terms
              </Link>
              <Link href="/privacy" className="footer-link">
                Privacy
              </Link>
            </div>
          </nav>
        </div>

        <div className="footer-bottom">
          <span>© 2026 Zecians</span>
          <div className="footer-bottom-group">
            <span>Built on Solana</span>
            {IS_DEV_CHAIN && (
              <span className="footer-devnet">
                {NETWORK_LABEL} · Test SOL only
              </span>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
