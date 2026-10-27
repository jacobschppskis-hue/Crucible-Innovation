import { FurnaceGL } from './FurnaceGL';

type Props = {
  /** 0–1: how hot this floor runs (glow and waves both scale with it). */
  heat?: number;
  /** How high the heat rises before it fades out, e.g. '45%'. */
  reach?: string;
  /** Rich tier: the Thesis's molten iron at this temperature (0–1) under the waves. */
  molten?: number;
  className?: string;
};

/**
 * The Thesis's furnace in small doses: a low glow off the floor with heat rising from it in waves. Pure CSS (the
 * waves only move while it's on screen, see InView); a static glow with reduced motion. Place it inside an
 * `isolate` box with overflow hidden: it sits behind that box's content.
 */
export function Furnace({ heat = 1, reach, molten, className = '' }: Props) {
  return (
    <div aria-hidden data-heat="" className={`furnace ${className}`} style={{ '--heat': heat, ...(reach && { '--reach': reach }) } as React.CSSProperties}>
      {molten !== undefined && <FurnaceGL heat={molten} />}
      <div className="furnace-waves">
        <i />
        <i />
      </div>
    </div>
  );
}
