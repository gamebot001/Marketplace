import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCollectionDetailData } from "@/lib/collection-detail-data";
import { collectionFontVars } from "@/components/collection/fonts";
import { CollectionItemView } from "@/components/collection/CollectionItemView";

export const dynamic = "force-dynamic";

export function generateMetadata({
  params,
}: {
  params: { slug: string; itemId: string };
}): Metadata {
  const data = getCollectionDetailData(params.slug);
  if (!data) return { title: "Item" };
  return { title: `${data.name} #${params.itemId}` };
}

export default function CollectionItemPage({
  params,
}: {
  params: { slug: string; itemId: string };
}) {
  const data = getCollectionDetailData(params.slug);
  if (!data) notFound();

  const item = data.items.find((entry) => String(entry.id) === params.itemId);
  if (!item) notFound();

  return (
    <div className={collectionFontVars}>
      <CollectionItemView data={data} item={item} />
    </div>
  );
}
