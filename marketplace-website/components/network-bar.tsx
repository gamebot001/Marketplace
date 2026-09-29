import { IS_DEVNET, NETWORK_LABEL } from "@/lib/config";
import { DEMO_MODE, DEMO_MARKET_LABEL } from "@/lib/demo-marketplace-data";

/**
 * System-status element, not an error banner. Visible while the build targets
 * a development chain so no one mistakes test activity for mainnet. While
 * demo data is active the label makes the preview explicit.
 */
export function NetworkBar() {
  if (!IS_DEVNET) return null;
  return (
    <div className="network-bar" role="status">
      <span className="dot" aria-hidden />
      <span>{DEMO_MODE ? DEMO_MARKET_LABEL : NETWORK_LABEL}</span>
      <span className="sep" aria-hidden>
        ·
      </span>
      <span>Test SOL only</span>
    </div>
  );
}
