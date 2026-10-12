import { P } from '../render/palette';

// ドット絵の 9 スライス枠を SVG で作り、CSS 変数として流し込む。
// 1 文字 = 1 ドット。border-image で 2 倍に拡大して使う。

function svgFrom(rows: string[], colors: Record<string, string>): string {
  const w = rows[0].length;
  const h = rows.length;
  let rects = '';
  rows.forEach((r, y) =>
    [...r].forEach((ch, x) => {
      const c = colors[ch];
      if (c) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>`;
    }),
  );
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" shape-rendering="crispEdges">${rects}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const WINDOW = [
  '..oooooooo..',
  '.oLLLLLLLLo.',
  'oLLooooooLLo',
  'oLoNNNNNNoLo',
  'oLoNNNNNNoLo',
  'oLoNNNNNNoLo',
  'oLoNNNNNNoLo',
  'oLoNNNNNNoLo',
  'oLoNNNNNNoLo',
  'oLLooooooLLo',
  '.oLLLLLLLLo.',
  '..oooooooo..',
];

const BUTTON = [
  '.oooooooo.',
  'oHHHHHHHHo',
  'oHFFFFFFSo',
  'oHFFFFFFSo',
  'oHFFFFFFSo',
  'oHFFFFFFSo',
  'oHFFFFFFSo',
  'oHFFFFFFSo',
  'oSSSSSSSSo',
  '.oooooooo.',
];

const INSET = [
  'SSSSSSSS',
  'SooooooL',
  'SoNNNNoL',
  'SoNNNNoL',
  'SoNNNNoL',
  'SoNNNNoL',
  'SooooooL',
  'LLLLLLLL',
];

export function installFrames(): void {
  const root = document.documentElement.style;
  root.setProperty('--frame-window', svgFrom(WINDOW, { o: P.ink, L: P.gray0, N: P.navy0 }));
  root.setProperty('--frame-window-gold', svgFrom(WINDOW, { o: P.ink, L: P.gold0, N: P.navy0 }));
  root.setProperty('--frame-paper', svgFrom(WINDOW, { o: P.brown1, L: P.sand2, N: P.sand0 }));
  root.setProperty('--frame-button', svgFrom(BUTTON, { o: P.ink, H: P.gray1, F: P.gray3, S: P.navy0 }));
  root.setProperty('--frame-button-hover', svgFrom(BUTTON, { o: P.ink, H: P.gold1, F: P.gray2, S: P.gray3 }));
  root.setProperty('--frame-button-primary', svgFrom(BUTTON, { o: P.ink, H: P.gold1, F: P.orange1, S: P.rust }));
  root.setProperty('--frame-button-primary-hover', svgFrom(BUTTON, { o: P.ink, H: P.white, F: P.gold0, S: P.orange1 }));
  root.setProperty('--frame-button-on', svgFrom(BUTTON, { o: P.ink, H: P.gray0, F: P.blue0, S: P.navy0 }));
  root.setProperty('--frame-inset', svgFrom(INSET, { o: P.ink, S: P.navy0, L: P.gray3, N: P.ink }));
}
