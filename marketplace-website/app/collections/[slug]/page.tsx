import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getCollectionDetailData,
  getLiveCollectionDetailData,
  type CollectionDetailData,
} from "@/lib/collection-detail-data";
import { DEMO_MODE } from "@/lib/demo-marketplace-data";
import { collectionFontVars } from "@/components/collection/fonts";
import { CollectionDetail } from "@/components/collection/CollectionDetail";

export const dynamic = "force-dynamic";

function loadCollection(slug: string): Promise<CollectionDetailData | null> {
  if (DEMO_MODE) return Promise.resolve(getCollectionDetailData(slug));
  return getLiveCollectionDetailData(slug);
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const data = await loadCollection(params.slug);
  if (!data) return { title: "Collection" };
  return {
    title: data.name,
    description:
      data.description || "A collection on the Zecians Marketplace.",
  };
}

export default async function CollectionDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const data = await loadCollection(params.slug);
  if (!data) notFound();

  return (
    <div className={collectionFontVars}>
      <CollectionDetail data={data} />
    </div>
  );
}
