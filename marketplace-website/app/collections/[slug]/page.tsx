import type { Metadata } from "next";
import { CollectionView } from "@/components/marketplace/collection-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Collection",
  description: "A verified collection on the Zecians Marketplace.",
};

export default function CollectionDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  return <CollectionView slug={params.slug} />;
}
