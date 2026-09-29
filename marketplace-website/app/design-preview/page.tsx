import type { Metadata } from "next";
import { DesignHero } from "@/components/home/design-hero";

export const metadata: Metadata = {
  title: "Design Preview — Hero Carousel",
  robots: { index: false, follow: false },
};

/*
 * Temporary reference route. The approved hero now lives at / — this route
 * renders the very same shared component in its original full-screen
 * preview variant (fixed stage + badge) for side-by-side comparison.
 */
export default function DesignPreviewPage() {
  return <DesignHero variant="preview" />;
}
