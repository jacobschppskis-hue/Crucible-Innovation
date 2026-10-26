import { RING, arcPath, pixels } from '@/lib/splitRing';

type Props = {
  size?: number | string;
  /** Draw-in on load + breathing ember glow. Pure CSS, so it also runs without JS. */
  animated?: boolean;
  /** Squares or dots for the machine half: a one-word swap. */
  pixel?: 'square' | 'dot';
  className?: string;
  title?: string;
};

export function SplitRing({ size = 64, animated = false, pixel = 'square', className, title = 'Crucible' }: Props) {
  const { c, px, stroke, rings } = RING;
  let k = 0; // global pixel index for the sequential pop-in stagger
  const svg = (
    <svg
      viewBox="0 0 64 64"
      width={animated ? undefined : size}
      height={animated ? undefined : size}
      {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}
      className={animated ? 'ring-svg ring-anim relative block h-full w-full' : `ring-svg ${className ?? ''}`}
    >
      {rings.map(({ r, n }) => (
        <g key={r}>
          <path className="ring-arc" d={arcPath(r)} pathLength={1} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="butt" />
          {pixels(r, n).map(({ x, y, deg }, i) => {
            const style = { '--i': k++ } as React.CSSProperties;
            // The CSS pop-in animates the <g>, so it never fights the rect's own SVG rotate().
            return (
              <g key={i} className="ring-px" style={style}>
                {pixel === 'dot' ? (
                  <circle cx={x} cy={y} r={px / 2} fill="currentColor" />
                ) : (
                  <rect x={x - px / 2} y={y - px / 2} width={px} height={px} fill="currentColor" transform={`rotate(${deg} ${x} ${y})`} />
                )}
              </g>
            );
          })}
        </g>
      ))}
      <circle className="ring-core" cx={c} cy={c} r={RING.core} fill="var(--ember)" />
    </svg>
  );

  if (!animated) return svg;
  return (
    <div className={`relative ${className ?? ''}`} style={{ width: size, height: size }}>
      <div aria-hidden className="ring-glow" />
      {svg}
    </div>
  );
}
