import Reveal, { MaskLines } from "@/components/reveal";

/** Editorial brand statement — large type, generous space, minimal copy. */
export default function BrandStatement() {
  return (
    <section className="statement section" aria-label="Brand statement">
      <div className="container">
        <Reveal className="section-label-row">
          <span className="section-label">The Brand</span>
        </Reveal>

        <Reveal as="p" className="statement-kicker" delay={0.05}>
          More than ownership
        </Reveal>

        <MaskLines
          as="h2"
          className="statement-h"
          baseDelay={0.12}
          lines={[
            <>Identity, culture</>,
            <>
              and digital presence <span className="em-amber">— held, not rented.</span>
            </>,
          ]}
        />

        <Reveal className="statement-note" delay={0.3}>
          <p>
            A Zecian is not a line item in a portfolio. It is a way of showing
            up — a mark of belonging that stays with the people who carry it.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
