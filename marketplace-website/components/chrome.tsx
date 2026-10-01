"use client";

/**
 * Global chrome gate. Every route shares ONE marketplace header. The devnet /
 * design-preview status strip renders on the homepage only, so inner pages stay
 * clean; the underlying network detection is unchanged (see NetworkBar).
 *
 * The one exception: the collections surfaces (/collections and
 * /collections/[slug]) omit the shared footer so the collections content is
 * the end of the page. Every other route keeps it.
 */

import { usePathname } from "next/navigation";
import { NetworkBar } from "@/components/network-bar";
import {
  MarketplaceHeader,
  MarketplaceFooter,
} from "@/components/marketplace-chrome";

const COLLECTION_DETAIL = /^\/collections\/[^/]+\/?$/;
const COLLECTIONS_INDEX = /^\/collections\/?$/;

export function ChromeTop() {
  const pathname = usePathname();
  const isHome = !pathname || pathname === "/";
  return (
    <>
      {isHome && <NetworkBar />}
      <MarketplaceHeader />
    </>
  );
}

export function ChromeBottom() {
  const pathname = usePathname();
  if (pathname && (COLLECTION_DETAIL.test(pathname) || COLLECTIONS_INDEX.test(pathname))) {
    return null;
  }
  return <MarketplaceFooter />;
}
