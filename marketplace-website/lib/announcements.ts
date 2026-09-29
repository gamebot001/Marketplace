/**
 * PRODUCT ANNOUNCEMENTS — static, deterministic notification content.
 * ----------------------------------------------------------------------------
 * These are product-level statements about the marketplace itself (fees,
 * features, featured collections, creator tooling). They are deliberately
 * separate from market data: no prices, volumes or trading activity are ever
 * presented as announcements, and nothing here is derived from the chain.
 *
 * Copy must stay consistent with the real product state (see DEMO_CONFIG and
 * the creator empty-state copy).
 */

export type AnnouncementTag =
  | "Product"
  | "Collections"
  | "Creators"
  | "Maintenance";

export interface Announcement {
  id: string;
  tag: AnnouncementTag;
  title: string;
  body: string;
  href?: string;
}

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: "fee-schedule",
    tag: "Product",
    title: "Marketplace fee is 2%",
    body: "Transparent, on-chain settlement — no hidden spread.",
    href: "/settings#network",
  },
  {
    id: "featured-dga",
    tag: "Collections",
    title: "DGA joins the featured rail",
    body: "Bold generative artwork, now spotlighted on the homepage.",
    href: "/collections/dga",
  },
  {
    id: "creator-onboarding",
    tag: "Creators",
    title: "Creator onboarding opens soon",
    body: "Minting tools and collection registration are in final testing.",
    href: "/create",
  },
];
