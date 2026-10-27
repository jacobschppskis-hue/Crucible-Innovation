type Props = { text: string; as?: 'p' | 'blockquote'; className?: string };

/**
 * Text that warms from dim to full bone, word by word, as it is read (scroll-linked: data-scroll="read" gives the
 * block --p, CSS does the rest). The server sends plain text; <ReadingHeat /> wraps the words after hydration, so
 * the HTML stays small. Dim still passes AA contrast; fully lit without JS and with reduced motion.
 */
export function HeatText({ text, as: Tag = 'p', className = '' }: Props) {
  return (
    <Tag data-scroll="read" className={`heat-text ${className}`}>
      {text}
    </Tag>
  );
}
