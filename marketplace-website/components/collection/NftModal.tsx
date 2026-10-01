"use client";

/**
 * NFT detail modal — a pure function of the clicked item plus its collection.
 *
 * Nothing about the collection is hardcoded here: the title, traits, rarity,
 * seller and artwork all come from the item/collection passed in, so opening a
 * card on any collection shows that collection's data. Wallet state is read
 * from the same source as the shared header (`useWallet` + `useWalletDialog`),
 * and every control has a real effect — buy, make offer, watchlist and
 * navigation.
 *
 * The same panel renders as a full page (`mode="page"`) for /collections/[slug]/
 * [itemId], reusing this exact markup and styles.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, Plus, Star, Wallet, X } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { CollectionDetailData, CollectionItem } from "@/lib/collection-detail-data";
import { shorten } from "@/lib/format";
import { explorerAddressUrl } from "@/lib/solana/cluster";
import { useWalletDialog } from "@/components/wallet/wallet-provider";
import { c } from "./collection-detail.styles";
import { useCollectionWatchlist } from "./useCollectionWatchlist";
import { Verify } from "./icons";

function pctMap(data: CollectionDetailData): Map<string, number> {
  const map = new Map<string, number>();
  for (const group of data.traitGroups) {
    for (const option of group.options) map.set(option.value, option.pct);
  }
  for (const option of data.colourOptions) map.set(option.value, option.pct);
  return map;
}

function statusText(status: CollectionItem["status"]): {
  badge: string;
  label: string;
} {
  if (status === "listed") return { badge: "Listed", label: "Active" };
  if (status === "auction") return { badge: "Auction", label: "On auction" };
  return { badge: "Unlisted", label: "Unlisted" };
}

export function NftModal({
  item,
  data,
  onClose,
  onToast,
  mode = "overlay",
}: {
  item: CollectionItem | null;
  data: CollectionDetailData;
  onClose: () => void;
  onToast: (message: string) => void;
  mode?: "overlay" | "page";
}) {
  const open = Boolean(item) || mode === "page";
  const active = item ?? data.items[0];
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");

  const { connected } = useWallet();
  const { open: openWallet } = useWalletDialog();
  const watchlist = useCollectionWatchlist();

  useEffect(() => {
    setOfferOpen(false);
    setOfferAmount("");
  }, [active?.id]);

  if (!active) return null;

  const pcts = pctMap(data);
  const { badge, label } = statusText(active.status);

  const traits = [
    { label: "Species", value: active.species },
    { label: "Scene", value: active.scene },
    { label: "Expression", value: active.expression },
    { label: "Colour", value: active.colour },
  ].filter((trait) => trait.value);

  const usd = (active.price * data.solUsd).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const watching = watchlist.has(active.asset);

  const handleBuy = () => {
    if (!connected) {
      openWallet();
      return;
    }
    onToast("Purchase flow not wired yet");
  };

  const submitOffer = () => {
    const amount = Number(offerAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      onToast("Enter a valid offer amount");
      return;
    }
    setOfferOpen(false);
    setOfferAmount("");
    onToast("Offer placed (demo)");
  };

  const panel = (
    <div className={c("modalPanel")}>
      <button
        type="button"
        className={c("modalClose")}
        aria-label="Close"
        onClick={onClose}
      >
        <X aria-hidden />
      </button>

      <div className={c("modalMedia")}>
        <span className={c("badge-lg")}>{badge}</span>
        <div className={c("art")}>
          {active.image ? (
            <img
              src={active.image}
              alt={active.name}
              draggable={false}
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="media-fallback">No artwork</div>
          )}
        </div>
      </div>

      <div className={c("modalInfo")}>
        <div className={c("miTop")}>
          <Link className={c("miColl")} href={`/collections/${data.slug}`}>
            {data.name}
          </Link>
          {typeof active.rank === "number" && active.rank > 0 ? (
            <span className={c("miRank")}>
              <Star aria-hidden />
              Rank #{active.rank}
            </span>
          ) : null}
        </div>

        <h2 className={c("miTitle")}>
          <span>{active.name}</span>
          {data.verified ? <Verify className={c("verify")} /> : null}
        </h2>

        <div className={c("miPriceBlock")}>
          <div className={c("miPriceMain")}>
            <div className={c("miPriceK")}>Current price</div>
            <div className={c("miPriceNum")}>
              <span>{active.price.toFixed(1)}</span>
              <small>SOL</small>
            </div>
            <div className={c("miPriceUsd")}>≈ ${usd} USD</div>
          </div>
          <div className={c("miPriceSide")}>
            <div className={c("miLast")}>
              <div className={c("k")}>Last sale</div>
              <div className={c("v")}>{active.lastSale.toFixed(1)} SOL</div>
            </div>
            <span className={c("miStatus")}>{label}</span>
          </div>
        </div>

        <div className={c("miSeller")}>
          <div className={c("miAvatar")}>
            {active.seller.slice(0, 1).toUpperCase()}
          </div>
          <div className={c("miSellerMeta")}>
            <div className={c("k")}>Seller</div>
            <div className={c("v")}>{shorten(active.seller, 5, 5)}</div>
          </div>
        </div>

        <div className={c("miActions")}>
          <button type="button" className={c("btnBuy")} onClick={handleBuy}>
            <Wallet aria-hidden />
            {connected ? "Buy now" : "Connect to buy"}
          </button>
          <button
            type="button"
            className={c("btnOutline")}
            aria-expanded={offerOpen}
            onClick={() => setOfferOpen((value) => !value)}
          >
            <Plus aria-hidden />
            Make Offer
          </button>
        </div>

        {offerOpen ? (
          <div className={c("offerBox")}>
            <div className={c("offerHead")}>Make an offer</div>
            <div className={c("offerField")}>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.0"
                value={offerAmount}
                autoFocus
                onChange={(event) => setOfferAmount(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") submitOffer();
                }}
              />
              <span className={c("offerUnit")}>SOL</span>
            </div>
            <div className={c("offerActions")}>
              <button
                type="button"
                className={c("offerCancel")}
                onClick={() => {
                  setOfferOpen(false);
                  setOfferAmount("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={c("offerSubmit")}
                onClick={submitOffer}
              >
                Submit offer
              </button>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          className={c("btnWatch", watching && "on")}
          aria-pressed={watching}
          onClick={() => watchlist.toggle(active.asset)}
        >
          <Heart aria-hidden fill={watching ? "currentColor" : "none"} />
          {watching ? "In watchlist" : "Add to watchlist"}
        </button>

        <div className={c("miInfoGrid")}>
          <div className={c("miInfoItem")}>
            <div className={c("k")}>Chain</div>
            <div className={c("v")}>{active.chain}</div>
          </div>
          <div className={c("miInfoItem")}>
            <div className={c("k")}>Royalty</div>
            <div className={c("v")}>{active.royalty}</div>
          </div>
          <div className={c("miInfoItem")}>
            <div className={c("k")}>Creator</div>
            <div className={c("v")}>{shorten(active.creator, 5, 5)}</div>
          </div>
          <div className={c("miInfoItem")}>
            <div className={c("k")}>Token</div>
            <div className={c("v")}>#{active.id}</div>
          </div>
        </div>

        {traits.length > 0 ? (
          <>
            <div className={c("miSectionH")}>Traits</div>
            <div className={c("miTraits")}>
              {traits.map((trait) => {
                const pct = pcts.get(trait.value);
                return (
                  <div className={c("miTrait")} key={trait.label}>
                    <div className={c("t-left")}>
                      <span className={c("t-type")}>{trait.label}</span>
                      <span className={c("t-value")}>{trait.value}</span>
                    </div>
                    <div className={c("t-bar")}>
                      <i style={{ width: `${pct ?? 0}%` }} />
                    </div>
                    <span className={c("t-pct")}>
                      {pct === undefined ? "—" : `${pct}%`}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}

        <div className={c("miAsset")}>
          <div className={c("lhs")}>
            <span className={c("k")}>Asset</span>
            <span className={c("v")}>{shorten(active.asset, 6, 6)}</span>
          </div>
          <a
            className={c("exp")}
            href={explorerAddressUrl(active.asset)}
            target="_blank"
            rel="noreferrer"
          >
            Explorer
          </a>
        </div>

        <p className={c("miDesc")}>
          {active.name} — part of the {data.name} collection on Zecians
          Marketplace.
        </p>

        {mode === "overlay" ? (
          <Link
            className={c("btnFull")}
            href={`/collections/${data.slug}/${active.id}`}
            onClick={onClose}
          >
            View full details
          </Link>
        ) : null}
      </div>
    </div>
  );

  if (mode === "page") {
    return (
      <div className={c("modal", "open", "modalStatic")} role="dialog" aria-modal="true">
        {panel}
      </div>
    );
  }

  return (
    <>
      <div
        className={c("modalBackdrop", open && "open")}
        onClick={onClose}
        aria-hidden
      />
      <div
        className={c("modal", open && "open")}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
      >
        {panel}
      </div>
    </>
  );
}
