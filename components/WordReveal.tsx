export type Segment = { t: string; className?: string } | { br: true; className?: string };

type Props = {
  segments: Segment[];
  as?: 'h1' | 'h2' | 'p';
  className?: string;
  /** Play on first paint (hero) instead of on first view. Pure CSS, so it doesn't wait for hydration. */
  immediate?: boolean;
  delayMs?: number;
};

/** Word-by-word blur-in (blur 8px→0, y 12px→0, 40ms stagger), once per load. <InView /> triggers it on first view. */
export function WordReveal({ segments, as: Tag = 'h2', className = '', immediate = false, delayMs = 0 }: Props) {
  let i = 0;
  return (
    <Tag
      className={`words ${className}`}
      data-words=""
      data-in={immediate ? '' : undefined}
      style={delayMs ? ({ '--d': `${delayMs}ms` } as React.CSSProperties) : undefined}
    >
      {segments.map((s, si) =>
        'br' in s ? (
          <br key={si} className={s.className} />
        ) : (
          s.t.split(' ').map((w, wi, arr) => (
            <span key={`${si}-${wi}`}>
              <span className={`w ${s.className ?? ''}`} style={{ '--i': i++ } as React.CSSProperties}>
                {w}
              </span>
              {wi < arr.length - 1 || si < segments.length - 1 ? ' ' : null}
            </span>
          ))
        ),
      )}
    </Tag>
  );
}
