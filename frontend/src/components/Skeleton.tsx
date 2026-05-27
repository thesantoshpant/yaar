// Reusable skeleton loaders for a subtle, polished "loading" feel. Content-shaped
// placeholders read as "almost there" instead of a blank screen or a lone spinner.
// Responsive by default (widths use fractions), and the shimmer respects reduced motion.

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

// A few lines of "text". The last line is shorter, like real paragraphs.
export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3.5 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}

// A card-shaped block: a title bar plus a few text lines.
export function SkeletonCard({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`card ${className}`} aria-hidden="true">
      <Skeleton className="h-5 w-1/3" />
      <div className="mt-3">
        <SkeletonText lines={lines} />
      </div>
    </div>
  );
}

// A vertical list of card skeletons, for lists/inboxes/history.
export function SkeletonList({ count = 3, lines = 2, className = "" }: { count?: number; lines?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={lines} />
      ))}
    </div>
  );
}
