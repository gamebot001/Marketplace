import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import Atmosphere from "@/components/atmosphere";
import ScrollProgress from "@/components/scroll-progress";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import "@/styles/globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3002"),
  title: {
    default: "Zecians — More than holders. A community of believers.",
    template: "%s — Zecians",
  },
  description:
    "Zecians is a premium digital culture and ownership brand. Explore the identity — then enter the marketplace.",
  keywords: [
    "Zecians",
    "digital culture",
    "digital ownership",
    "Solana",
    "NFT marketplace",
  ],
  openGraph: {
    type: "website",
    siteName: "Zecians",
    title: "Zecians — More than holders. A community of believers.",
    description:
      "Zecians is a premium digital culture and ownership brand. Explore the identity — then enter the marketplace.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body>
        <noscript>
          <style>{`.reveal,.mask-line,.rule{opacity:1!important;transform:none!important}.intro-veil{display:none}`}</style>
        </noscript>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Atmosphere />
        <ScrollProgress />
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
