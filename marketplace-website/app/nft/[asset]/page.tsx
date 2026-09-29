import type { Metadata } from "next";
import { NftDetail } from "@/components/marketplace/nft-detail";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Asset",
  description: "View a digital asset on the Zecians Marketplace.",
};

export default function NftDetailPage({
  params,
}: {
  params: { asset: string };
}) {
  return <NftDetail assetAddress={params.asset} />;
}
