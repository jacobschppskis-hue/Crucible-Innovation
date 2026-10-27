import { Fragment } from 'react';

type Props = { text: string; as?: 'p' | 'blockquote'; className?: string };

/**
 * Text that warms from dim to full bone, word by word, as it is read (scroll-linked: data-scroll="read" gives the
 * block --p, CSS does the rest). The dim state still passes AA contrast. Fully lit without JS and with reduced motion.
 */
export function HeatText({ text, as: Tag = 'p', className = '' }: Props) {
  const words = text.split(' ');
  return (
    <Tag data-scroll="read" className={`heat-text ${className}`} style={{ '--n': words.length } as React.CSSProperties}>
      {words.map((w, i) => (
        <Fragment key={i}>
          <span style={{ '--i': i } as React.CSSProperties}>{w}</span>
          {i < words.length - 1 ? ' ' : null}
        </Fragment>
      ))}
    </Tag>
  );
}
