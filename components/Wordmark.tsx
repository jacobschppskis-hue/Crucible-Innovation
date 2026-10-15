type Props = { sites?: boolean; className?: string };

/** "Spark": lowercase crucible, the tittle of the i replaced by an Ember dot. */
export function Wordmark({ sites = false, className = '' }: Props) {
  return (
    <span className={`inline-flex items-baseline gap-[0.4em] whitespace-nowrap ${className}`}>
      <span className="sr-only">{sites ? 'Crucible Sites' : 'Crucible'}</span>
      <span aria-hidden className="font-display font-semibold tracking-[-0.03em] leading-none">
        cruc<span className="spark-i">ı</span>ble
      </span>
      {sites && (
        <span aria-hidden className="font-mono text-[0.62em] uppercase tracking-[0.14em] text-bone-dim leading-none">
          sites
        </span>
      )}
    </span>
  );
}
