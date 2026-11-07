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
 * Molten metal glowing up from the floor, with heat rising from it in waves. The CSS layer is complete on its own (the
 * waves only move while it's on screen, see InView; still with reduced motion); on the rich tier the GL surface fades
 * in over it on the one clock. Place it inside an `isolate` box: it sits behind that box's content.
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
