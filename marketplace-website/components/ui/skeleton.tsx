/** Loading placeholders. Reserve layout so content does not jump. */
export function CardSkeletons({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-4" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton skeleton-card" />
      ))}
    </div>
  );
}

export function LineSkeleton({ width = "100%" }: { width?: string }) {
  return (
    <div
      className="skeleton"
      style={{ height: 14, width, borderRadius: 2, border: 0 }}
      aria-hidden
    />
  );
}
