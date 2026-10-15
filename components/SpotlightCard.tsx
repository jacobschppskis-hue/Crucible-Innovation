'use client';

type Props = React.HTMLAttributes<HTMLElement> & { as?: 'div' | 'article' | 'li' };

/** Linear-style card: a radial spotlight follows the cursor across the surface and the 1px border. */
export function SpotlightCard({ as: Tag = 'div', className = '', children, ...rest }: Props) {
  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse') return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  return (
    <Tag className={`spot ${className}`} onPointerMove={onPointerMove} {...rest}>
      {children}
    </Tag>
  );
}
