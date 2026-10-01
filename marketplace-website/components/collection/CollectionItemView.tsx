"use client";

/**
 * Full-page view of a single item. Reuses the exact modal panel markup and the
 * collection page tokens, so /collections/[slug]/[itemId] is the modal content
 * rendered as a page — no separate design.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CollectionDetailData, CollectionItem } from "@/lib/collection-detail-data";
import { c } from "./collection-detail.styles";
import { NftModal } from "./NftModal";

type Theme = "dark" | "light";

export function CollectionItemView({
  data,
  item,
}: {
  data: CollectionDetailData;
  item: CollectionItem;
}) {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>("dark");
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef(0);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("zecians-theme");
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {
      /* storage unavailable */
    }
    return () => window.clearTimeout(toastTimer.current);
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1600);
  }, []);

  return (
    <div className={c("page")} data-theme={theme}>
      <main className={c("shell")}>
        <NftModal
          item={item}
          data={data}
          mode="page"
          onClose={() => router.push(`/collections/${data.slug}`)}
          onToast={showToast}
        />
      </main>
      <div className={c("toast", toast && "show")}>{toast ?? ""}</div>
    </div>
  );
}
