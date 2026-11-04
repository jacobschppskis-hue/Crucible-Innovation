// Scroll-scrubbed film: a rendered frame sequence (film/*.py → public/film/<name>/<width>/NNN.webp) drawn on a canvas.
// Frames load sparsely first (every 8th, then every 4th, 2nd, 1st), so scrubbing works almost at once and sharpens
// as the rest arrive; until a frame has loaded its nearest loaded neighbour is drawn. Draws only when the wanted frame
// changes and only while the canvas is on screen. Rich tier only: the light tier shows the poster.

type Options = {
  canvas: HTMLCanvasElement;
  /** e.g. '/film/iron' */
  base: string;
  count: number;
  /** Available widths, smallest first. */
  widths: number[];
  /** 0 → 1: which frame to show. */
  progress: () => number;
  /** Called once the first frame is on screen. */
  onReady?: () => void;
};

export type Film = (() => void) & { update: () => void };

export function startFilm({ canvas, base, count, widths, progress, onReady }: Options): Film {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return Object.assign(() => {}, { update: () => {} });
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const want = canvas.clientWidth * dpr;
  const w = widths.find((x) => x >= want * 0.9) ?? widths[widths.length - 1];
  const frames: (HTMLImageElement | null)[] = new Array(count).fill(null);
  let dead = false;
  let visible = false;
  let raf = 0;
  let drawn = -1;
  let ready = false;

  const order: number[] = [];
  const seen = new Set<number>();
  for (const step of [8, 4, 2, 1]) for (let i = 0; i < count; i += step) if (!seen.has(i)) (seen.add(i), order.push(i));
  if (!seen.has(count - 1)) order.splice(1, 0, count - 1);

  // Load a few at a time, in order.
  let next = 0;
  let inflight = 0;
  const pump = () => {
    while (!dead && inflight < 4 && next < order.length) {
      const i = order[next++];
      const img = new Image();
      img.decoding = 'async';
      inflight++;
      img.onload = () => {
        inflight--;
        frames[i] = img;
        drawn = -1; // a better frame may now exist for the current position
        schedule();
        pump();
      };
      img.onerror = () => {
        inflight--;
        pump();
      };
      img.src = `${base}/${w}/${String(i).padStart(3, '0')}.webp`;
    }
  };

  const nearest = (i: number) => {
    for (let d = 0; d < count; d++) {
      if (frames[i - d]) return i - d;
      if (frames[i + d]) return i + d;
    }
    return -1;
  };

  const resize = () => {
    const cw = Math.round(canvas.clientWidth * dpr);
    const ch = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
      drawn = -1;
    }
  };

  const draw = () => {
    raf = 0;
    if (dead || !visible) return;
    const target = Math.round(Math.max(0, Math.min(1, progress())) * (count - 1));
    const i = nearest(target);
    if (i < 0 || i === drawn) return;
    const img = frames[i]!;
    resize();
    // object-fit: cover
    const s = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
    const dw = img.naturalWidth * s;
    const dh = img.naturalHeight * s;
    ctx.drawImage(img, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
    drawn = i;
    if (!ready) {
      ready = true;
      onReady?.();
    }
  };
  const schedule = () => {
    if (!raf && visible) raf = requestAnimationFrame(draw);
  };

  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) {
      if (next === 0) pump();
      schedule();
    }
  });
  io.observe(canvas);
  const onResize = () => {
    drawn = -1;
    schedule();
  };
  addEventListener('resize', onResize);

  return Object.assign(
    () => {
      dead = true;
      io.disconnect();
      removeEventListener('resize', onResize);
      cancelAnimationFrame(raf);
    },
    { update: schedule },
  );
}
