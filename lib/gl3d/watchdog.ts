// One long-task watchdog for all 3D scenes on the main thread: when long tasks keep coming (3 within 3 s, 300 ms in
// total) every listener is told to lower its quality. Not started with ?liquid=full.
const subs = new Set<() => void>();
let po: PerformanceObserver | null = null;

export function onLongTasks(cb: () => void) {
  if (/[?&]liquid=full\b/.test(location.search)) return () => {};
  subs.add(cb);
  if (!po) {
    const recent: [number, number][] = [];
    let cool = 0;
    try {
      po = new PerformanceObserver((list) => {
        const t = performance.now();
        for (const en of list.getEntries()) recent.push([en.startTime, en.duration]);
        while (recent.length && recent[0][0] < t - 3000) recent.shift();
        const total = recent.reduce((a, r) => a + r[1], 0);
        if (recent.length >= 3 && total > 300 && t > cool) {
          cool = t + 2000;
          for (const f of subs) f();
        }
      });
      po.observe({ type: 'longtask', buffered: false });
    } catch {
      po = null;
    }
  }
  return () => {
    subs.delete(cb);
    if (!subs.size) {
      po?.disconnect();
      po = null;
    }
  };
}
