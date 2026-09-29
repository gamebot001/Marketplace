import Image from "next/image";
import Reveal, { MaskLines } from "@/components/reveal";

const PILLARS = [
  {
    title: "Digital Identity",
    copy: "A Zecian is a signature — how you appear, and what you stand behind, on-chain.",
  },
  {
    title: "Community",
    copy: "Holders shape the brand. Access, voice and direction belong to the people who arrive early and stay.",
  },
  {
    title: "Ownership",
    copy: "Real ownership is proven, not promised. Every piece lives on Solana — verifiable, portable, yours.",
  },
  {
    title: "Culture",
    copy: "Art, ritual and presence. Culture is what remains when the noise moves on.",
  },
];

/** What Zecians represents — editorial rows, progressive reveal, one artifact. */
export default function Identity() {
  return (
    <section id="identity" className="section" aria-label="What Zecians represents">
      <div className="container">
        <Reveal className="section-label-row">
          <span className="section-label">Identity</span>
        </Reveal>

        <div className="identity-grid">
          <div>
            <MaskLines
              as="h2"
              className="identity-h"
              lines={[<>What it means</>, <>to be a Zecian.</>]}
            />
            <Reveal as="p" className="identity-lede" delay={0.2}>
              Four ideas carry the brand. They are not features — they are the
              reason the collection exists.
            </Reveal>
          </div>

          <Reveal as="figure" className="artifact" delay={0.25}>
            <div className="artifact-img-wrap">
              <Image
                src="/artwork/zecian-005.png"
                alt="Original Zecians artwork — Zecian 005"
                width={1024}
                height={1024}
                sizes="(max-width: 1024px) 320px, 300px"
              />
            </div>
            <figcaption>
              <span>Zecian 005 — Original artwork</span>
              <span>001 / 005</span>
            </figcaption>
          </Reveal>
        </div>

        <div className="id-rows">
          {PILLARS.map((pillar, i) => (
            <Reveal as="article" className="id-row" key={pillar.title} delay={i * 0.07}>
              <span className="id-num" aria-hidden="true">
                0{i + 1}
              </span>
              <h3 className="id-title">{pillar.title}</h3>
              <p className="id-copy">{pillar.copy}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
