"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * Premium artwork presentation. Fills its (relatively-positioned) container,
 * lazy-loads, and degrades to an honest placeholder when no artwork is
 * available or the source fails to load.
 *
 * Local demo assets (static files under /demo-marketplace/) are served
 * unoptimized: they are already production artwork, the optimizer adds no
 * value for them, and transforming ~20 of them per page can saturate the
 * server during first load.
 */
export function Artwork({
  src,
  alt,
  sizes = "(max-width: 560px) 100vw, (max-width: 1080px) 50vw, 25vw",
  priority = false,
}: {
  src: string | null;
  alt: string;
  sizes?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <div className="media-fallback">No artwork</div>;
  }

  const isLocalStatic = src.startsWith("/demo-marketplace/");

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={isLocalStatic}
      onError={() => setFailed(true)}
      style={{ objectFit: "cover" }}
    />
  );
}
