import type { Metadata } from "next";
import "./globals.css";
import "./marketplace-chrome.css";
import { Providers } from "@/components/wallet/wallet-provider";
import { TransactionProvider } from "@/components/marketplace/transaction/transaction-provider";
import { WatchlistProvider } from "@/components/marketplace/watchlist";
import { NftQuickViewProvider } from "@/components/marketplace/nft-quick-view";
import { Atmosphere } from "@/components/atmosphere";
import { ScrollProgress } from "@/components/ui/motion";
import { OverlayHostSentinel } from "@/components/ui/overlay-portal";
import { ChromeTop, ChromeBottom } from "@/components/chrome";
import { IS_DEVNET } from "@/lib/config";

export const metadata: Metadata = {
  title: {
    default: "Zecians Marketplace — Discover, Collect, Trade",
    template: "%s · Zecians Marketplace",
  },
  description:
    "A premium Solana NFT marketplace. Discover, collect and trade verified digital collections — real listings, transparent fees, on-chain settlement.",
  applicationName: "Zecians Marketplace",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-chrome={IS_DEVNET ? "net" : "netless"}>
      <body suppressHydrationWarning>
        <div className="page-backdrop" aria-hidden="true" />
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Providers>
          <TransactionProvider>
            <WatchlistProvider>
              <NftQuickViewProvider>
                <Atmosphere />
                <ScrollProgress />
                <div className="mp-shell">
                  <ChromeTop />
                  <main className="mp-main" id="main">
                    {children}
                  </main>
                  <ChromeBottom />
                </div>
              </NftQuickViewProvider>
            </WatchlistProvider>
          </TransactionProvider>
        </Providers>
        <div id="marketplace-overlays" />
        <OverlayHostSentinel />
      </body>
    </html>
  );
}
