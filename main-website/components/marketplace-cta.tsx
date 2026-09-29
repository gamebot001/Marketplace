import { MARKETPLACE_URL } from "@/lib/config";
import { ArrowRight } from "@/components/arrows";

type MarketplaceCtaProps = {
  size?: "lg" | "xl";
  label?: string;
  className?: string;
};

/**
 * The single gateway to the marketplace application. The destination always
 * resolves through lib/config (NEXT_PUBLIC_MARKETPLACE_URL) — never hardcoded.
 */
export default function MarketplaceCta({
  size = "lg",
  label = "Enter Marketplace",
  className = "",
}: MarketplaceCtaProps) {
  return (
    <a
      className={`cta cta-primary cta-${size} ${className}`.trim()}
      href={MARKETPLACE_URL}
    >
      <span>{label}</span>
      <ArrowRight />
    </a>
  );
}
