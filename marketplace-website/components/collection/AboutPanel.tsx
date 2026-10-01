"use client";

import { ArrowUpRight, Copy } from "lucide-react";
import type { CollectionDetailData } from "@/lib/collection-detail-data";
import { shorten } from "@/lib/format";
import { c } from "./collection-detail.styles";

export function AboutPanel({
  data,
  onCopyCreator,
}: {
  data: CollectionDetailData;
  onCopyCreator: () => void;
}) {
  return (
    <div className={c("aboutLayout")}>
      <div className={c("aboutHero")}>
        <h3>{data.about.heading}</h3>
        {data.about.paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
        <div className={c("about-meta-row")}>
          <div className={c("am")}>
            <div className={c("k")}>Launched</div>
            <div className={c("v")}>{data.launched}</div>
          </div>
          <div className={c("am")}>
            <div className={c("k")}>Chain</div>
            <div className={c("v")}>{data.chain}</div>
          </div>
          <div className={c("am")}>
            <div className={c("k")}>Items</div>
            <div className={c("v")}>{data.totalItems}</div>
          </div>
          <div className={c("am")}>
            <div className={c("k")}>Royalty</div>
            <div className={c("v")}>{data.royalty}</div>
          </div>
        </div>
      </div>

      <div className={c("aboutCols")}>
        <div className={c("aboutCard")}>
          <h4>Trait distribution</h4>
          <div className={c("tbRows")}>
            {data.traitDistribution.map((trait) => (
              <div className={c("tbRow")} key={trait.value}>
                <span className={c("tb-name")}>{trait.value}</span>
                <div className={c("tbBar")}>
                  <i style={{ width: `${trait.pct}%` }} />
                </div>
                <span className={c("tb-pct")}>{trait.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className={c("aboutCard")}>
          <h4>Creator</h4>
          <div className={c("creatorBlock")}>
            <div className={c("creatorAvatar")}>
              {data.name.slice(0, 1).toUpperCase()}
            </div>
            <div className={c("creatorMeta")}>
              <div className={c("k")}>Address</div>
              <div className={c("v")}>
                {shorten(data.creator, 5, 4)}
                <button
                  type="button"
                  aria-label="Copy creator address"
                  onClick={onCopyCreator}
                  style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", display: "grid" }}
                >
                  <Copy size={11} />
                </button>
              </div>
            </div>
          </div>
          <div className={c("aboutLinks")}>
            {data.about.links.map((link) => (
              <a
                className={c("aboutLink")}
                key={link.label}
                href={link.href}
                onClick={(event) => event.preventDefault()}
              >
                {link.label}
                <ArrowUpRight aria-hidden />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
