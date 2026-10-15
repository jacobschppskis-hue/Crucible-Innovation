type Props = { children: React.ReactNode; className?: string; delay?: number; as?: 'div' | 'li' | 'section' };

/**
 * Fade + 16px rise at 15% visibility, once. Pure markup: <InView /> in the layout flips `data-in`.
 * Content is only hidden when JS is running (the `.js` class), so it stays readable without it.
 */
export function Reveal({ children, className, delay = 0, as: Tag = 'div' }: Props) {
  return (
    <Tag data-reveal="" className={className} style={delay ? ({ '--delay': `${delay}s` } as React.CSSProperties) : undefined}>
      {children}
    </Tag>
  );
}
