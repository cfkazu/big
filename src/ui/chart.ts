import { P } from '../render/palette';

export interface Series {
  values: number[];
  color: string;
}

/** ドットの折れ線グラフ（等倍で描いて 2 倍表示） */
export function lineChart(series: Series[], opts: { w?: number; h?: number; min?: number; max?: number } = {}): HTMLCanvasElement {
  const w = opts.w ?? 156;
  const h = opts.h ?? 48;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  cv.className = 'chart';
  cv.style.width = `${w * 2}px`;
  cv.style.height = `${h * 2}px`;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = P.ink;
  ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 12) for (let x = 0; x < w; x += 2) {
    ctx.fillStyle = P.navy0;
    ctx.fillRect(x, y, 1, 1);
  }
  const all = series.flatMap((s) => s.values).filter((v) => Number.isFinite(v));
  if (all.length === 0) return cv;
  let min = opts.min ?? Math.min(...all);
  let max = opts.max ?? Math.max(...all);
  if (max - min < 1e-9) {
    max += 1;
    min -= 1;
  }
  const n = Math.max(...series.map((s) => s.values.length));
  const X = (i: number) => (n <= 1 ? w - 2 : Math.round(1 + (i * (w - 3)) / (n - 1)));
  const Y = (v: number) => Math.round(h - 2 - ((v - min) / (max - min)) * (h - 4));
  for (const s of series) {
    ctx.fillStyle = s.color;
    let px: number | null = null;
    let py: number | null = null;
    s.values.forEach((v, i) => {
      // 値の欠けた年は線を途切れさせる
      if (!Number.isFinite(v)) {
        px = null;
        py = null;
        return;
      }
      const x = X(i);
      const y = Y(v);
      if (px !== null && py !== null) {
        // ブレゼンハムで 1px の線
        let x0 = px, y0 = py;
        const dx = Math.abs(x - x0), dy = -Math.abs(y - y0);
        const sx = x0 < x ? 1 : -1, sy = y0 < y ? 1 : -1;
        let err = dx + dy;
        for (;;) {
          ctx.fillRect(x0, y0, 1, 1);
          if (x0 === x && y0 === y) break;
          const e2 = 2 * err;
          if (e2 >= dy) { err += dy; x0 += sx; }
          if (e2 <= dx) { err += dx; y0 += sy; }
        }
      } else ctx.fillRect(x, y, 1, 1);
      px = x;
      py = y;
    });
  }
  return cv;
}
