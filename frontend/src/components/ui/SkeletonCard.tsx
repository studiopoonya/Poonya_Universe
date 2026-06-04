export default function SkeletonCard({ className = '' }: { className?: string }) {
  return <div className={`rounded-2xl bg-surface-subtle animate-pulse ${className}`} />
}
