import { RING, arcOutline, cells } from '@/lib/splitRing';

type Props = {
  size?: number | string;
  /** Pop-in on load + breathing ember glow. Pure CSS, so it also runs without JS. */
  animated?: boolean;
  /** Squares or dots for the machine half's free cells: a one-word swap. */
  pixel?: 'square' | 'dot';
  className?: string;
  title?: string;
};

/** The Split Ring (lib/splitRing.ts): each band is one filled outline ending on the core's centre line; the squares are upright, on the circles. */
export function SplitRing({ size = 64, animated = false, pixel = 'square', className, title = 'Crucible' }: Props) {
  const { c, px, rings } = RING;
  const free = cells();
  const svg = (
    <svg
      viewBox="0 0 64 64"
      width={animated ? undefined : size}
      height={animated ? undefined : size}
      {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}
      className={animated ? 'ring-svg ring-anim relative block h-full w-full' : `ring-svg ${className ?? ''}`}
    >
      {rings.map(({ r }) => (
        <path key={r} className="ring-arc" d={arcOutline(r)} fill="currentColor" />
      ))}
      {free.map(({ x, y }, i) => (
        // The CSS pop-in animates the <g>, so it never touches the (upright) rect.
        <g key={i} className="ring-px" style={{ '--i': i } as React.CSSProperties}>
          {pixel === 'dot' ? (
            <circle cx={x} cy={y} r={px / 2} fill="currentColor" />
          ) : (
            <rect x={x - px / 2} y={y - px / 2} width={px} height={px} fill="currentColor" />
          )}
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
