'use client';

type Props = React.HTMLAttributes<HTMLElement> & { as?: 'div' | 'article' | 'li'; tilt?: boolean };

/**
 * Linear-style card: a radial spotlight follows the cursor across the surface and the 1px border.
 * With `tilt`, the card also leans up to 3° toward the cursor and lifts slightly (mouse only).
 */
export function SpotlightCard({ as: Tag = 'div', className = '', tilt = false, children, ...rest }: Props) {
  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse') return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    el.style.setProperty('--mx', `${x}px`);
    el.style.setProperty('--my', `${y}px`);
    if (tilt) {
      el.style.setProperty('--ry', `${((x / r.width - 0.5) * 6).toFixed(2)}deg`);
      el.style.setProperty('--rx', `${((0.5 - y / r.height) * 6).toFixed(2)}deg`);
    }
  };
  const onPointerLeave = (e: React.PointerEvent<HTMLElement>) => {
    if (!tilt) return;
    e.currentTarget.style.setProperty('--rx', '0deg');
    e.currentTarget.style.setProperty('--ry', '0deg');
  };
  return (
    <Tag className={`spot ${tilt ? 'spot-tilt' : ''} ${className}`} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave} {...rest}>
      {children}
    </Tag>
  );
}
