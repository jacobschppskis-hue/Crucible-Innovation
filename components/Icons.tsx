type P = { className?: string };
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

export const ArrowRight = ({ className = 'size-4' }: P) => (
  <svg viewBox="0 0 16 16" className={className} {...base}><path d="M3 8h10M9 4l4 4-4 4" /></svg>
);
export const Check = ({ className = 'size-4' }: P) => (
  <svg viewBox="0 0 16 16" className={className} {...base}><path d="M3 8.5l3.2 3L13 4.5" /></svg>
);
export const Plus = ({ className = 'size-4' }: P) => (
  <svg viewBox="0 0 16 16" className={className} {...base}><path d="M8 3v10M3 8h10" /></svg>
);
