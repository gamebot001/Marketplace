"use client";

/**
 * Global chrome gate. Every route — homepage included — shares ONE
 * marketplace chrome: the network status strip, the unified header and the
 * unified footer (components/marketplace-chrome.tsx).
 */

import { NetworkBar } from "@/components/network-bar";
import {
  MarketplaceHeader,
  MarketplaceFooter,
} from "@/components/marketplace-chrome";

export function ChromeTop() {
  return (
    <>
      <NetworkBar />
      <MarketplaceHeader />
    </>
  );
}

export function ChromeBottom() {
  return <MarketplaceFooter />;
}
