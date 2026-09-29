import { BadgeCheck } from "lucide-react";

/** Verified-collection mark. Never shown unless the API reports verification. */
export function VerifiedBadge({ label = "Verified" }: { label?: string }) {
  return (
    <span className="verified" title="Verified collection">
      <BadgeCheck size={14} aria-hidden />
      {label}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const className =
    normalized === "active"
      ? "badge badge-gold"
      : normalized === "sold" || normalized === "confirmed"
        ? "badge badge-positive"
        : normalized === "cancelled" || normalized === "expired"
          ? "badge badge-danger"
          : "badge";
  return <span className={className}>{status}</span>;
}

export function NetworkBadge({ label }: { label: string }) {
  return <span className="badge">{label}</span>;
}
