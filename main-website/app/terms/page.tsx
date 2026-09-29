import type { Metadata } from "next";
import Reveal, { MaskLines } from "@/components/reveal";

export const metadata: Metadata = {
  title: "Terms",
  description: "Terms that apply to the Zecians main brand website.",
};

export default function TermsPage() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <Reveal className="section-label-row">
            <span className="section-label">Legal</span>
          </Reveal>
          <MaskLines as="h1" lines={[<>Terms.</>]} />
          <Reveal as="p" className="page-lede" delay={0.2}>
            The ground rules for using the Zecians brand website.
          </Reveal>
        </div>
      </section>

      <section className="section" aria-label="Terms of use">
        <div className="container">
          <div className="prose" style={{ paddingTop: 0 }}>
            <Reveal as="p" className="prose-updated">
              Last updated — September 2026
            </Reveal>
            <Reveal as="p">
              These terms apply to the <strong>Zecians main brand website</strong>
              . The Zecians Marketplace is a separate application governed by
              its own terms, presented within that product.
            </Reveal>

            <h2>Using this site</h2>
            <p>
              You may browse this site freely. You agree not to misuse it — no
              attempts to disrupt availability, scrape at scale, or present the
              Zecians brand and artwork as your own.
            </p>

            <h2>Brand and artwork</h2>
            <p>
              The Zecians name, wordmark, artwork and site design belong to the
              Zecians project. Ownership of a Zecians asset grants the rights
              associated with the collection&rsquo;s license — it does not
              transfer ownership of the brand itself.
            </p>

            <h2>No financial advice</h2>
            <p>
              Nothing on this website is financial, investment or legal advice.
              Digital assets carry risk, including total loss. Any decision to
              acquire, hold or trade is entirely your own.
            </p>

            <h2>Development networks</h2>
            <p>
              While Zecians operates on development networks, all activity is
              experimental and uses test SOL with no real-world value. Assets
              and listings may be reset or withdrawn without notice.
            </p>

            <h2>Liability</h2>
            <p>
              This website is provided &ldquo;as is&rdquo;, without warranties
              of any kind. To the fullest extent permitted by law, the Zecians
              project is not liable for damages arising from use of this site
              or reliance on its content.
            </p>

            <h2>Changes</h2>
            <p>
              These terms may be updated from time to time. Continued use of
              the site after changes are published constitutes acceptance.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
