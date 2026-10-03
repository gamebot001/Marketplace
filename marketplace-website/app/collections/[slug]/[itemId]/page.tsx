import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getCollectionDetailData,
  getLiveCollectionDetailData,
  type CollectionDetailData,
} from "@/lib/collection-detail-data";
import { DEMO_MODE } from "@/lib/demo-marketplace-data";
import { collectionFontVars } from "@/components/collection/fonts";
import { CollectionItemView } from "@/components/collection/CollectionItemView";

export const dynamic = "force-dynamic";

function loadCollection(slug: string): Promise<CollectionDetailData | null> {
  if (DEMO_MODE) return Promise.resolve(getCollectionDetailData(slug));
  return getLiveCollectionDetailData(slug);
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string; itemId: string };
}): Promise<Metadata> {
  const data = await loadCollection(params.slug);
  if (!data) return { title: "Item" };
  const item = data.items.find((entry) => String(entry.id) === params.itemId);
  return { title: item ? item.name : data.name };
}

export default async function CollectionItemPage({
  params,
}: {
  params: { slug: string; itemId: string };
}) {
  const data = await loadCollection(params.slug);
  if (!data) notFound();

  const item = data.items.find((entry) => String(entry.id) === params.itemId);
  if (!item) notFound();

  return (
    <div className={collectionFontVars}>
      <CollectionItemView data={data} item={item} />
    </div>
  );
}
