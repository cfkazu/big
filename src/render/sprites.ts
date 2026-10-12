import { COATS, P, type CoatKey } from './palette';

// ─────────────────────────────────────────────
// 手打ちのドット絵。左向きで描き、右向きは反転して作る。
//  o 輪郭 / d 影 / b 地 / h ハイライト（毛色で変わる）
//  e 目 / w 牙・ヒゲ
//  n 鼻（成獣オスの垂れ鼻）
// 衛星型のオスは、エリマキシギの衛星オスにならって頭から首が白い（たてがみ）。
// ─────────────────────────────────────────────

const MALE = [
  '..........oooo..................',
  '........oohhhhoo................',
  '.......ohhbbbbbbo...............',
  '......ohbbbbbbbbbo..............',
  '.....ohbbebbbbbbbboooooo........',
  '...oonbbbbbbbbbbbbbhhhhhooooo...',
  '..onnnbbbbbbbbbbbbbbbbbbhhhhhoo.',
  '.onnnnbbbbbbbbbbbbbbbbbbbbbbbbho',
  '.onnwnbbbbbbbbbbbbbbbbbbbbbbbbbo',
  '..oonnbbbbbbbbbbbbbbbbbbbbbbbbbo',
  '....obbbbbbbbbbbbbbbbbbbbbbbbddo',
  '....obbbdbbbbbbbbbbbbbbbbbbbddo.',
  '....odddddbbbbddbbbbbbbbbbbdddoo',
  '...oddoodddddddddddddddddddododo',
  '...ooo..oooooooooooooooooooo.ooo',
];

const MALE_REAR = [
  '.....oooo...............',
  '...oohhhhoo.............',
  '..ohhbbbbbbo............',
  '.ohbbebbbbbbo...........',
  'onnbbbbbbbbbo...........',
  'onnnbbbbbbbbbo..........',
  'onwnbbbbbbbbbo..........',
  '.onnbbbbbbbbbo..........',
  '..obbbbbbbbbbbho........',
  '..obbbbbbbbbbbbhoo......',
  '..obbbbbbbbbbbbbbhhoo...',
  '..oddbbbbbbbbbbbbbbbbho.',
  '..oddbbbbbbbbbbbbbbbbbbo',
  '..odddbbbbbbbbbbbbbbbbbo',
  '..odddddbbbbbbbbbbbbbddo',
  '..oddoodddddddddddddddoo',
  '..ooo..oooooooooooooooo.',
];

const SUBADULT = [
  '.......ooo.............',
  '.....oohhboo...........',
  '....ohbbbbbbo..........',
  '...ohbebbbbbboooo......',
  '..onbbbbbbbbbbhhhoooo..',
  '.onnbbbbbbbbbbbbbbbhho.',
  '.onwbbbbbbbbbbbbbbbbbbo',
  '..onbbbbbbbbbbbbbbbbddo',
  '...obbbdbbbbbbbbbbbddo.',
  '...oddoddddddddddddodo.',
  '...ooo.oooooooooooo.oo.',
];

const FEMALE = [
  '...ooo..............',
  '..ohhho.............',
  '.ohbbbhoooo.........',
  'ohbebbbbhhhooo......',
  'odbbbbbbbbbbbhoo....',
  '.owbbbbbbbbbbbbbo...',
  '..oddbbbbbbbbbbbddo.',
  '..ododdddddddddddodo',
  '..oo.oooooooooooo.oo',
];

const JUVENILE = [
  '..ooo..........',
  '.ohhho.........',
  'ohbebhoooo.....',
  'odbbbbbhhhoo...',
  '.odbbbbbbbbbo..',
  '..oddddddddddo.',
  '..oo.ooooooo.oo',
];

const PUP = [
  '.ooo......',
  'ohhho.....',
  'obebhooo..',
  'obbbbbbbo.',
  '.oddddddoo',
  '..ooooooo.',
];

export type SpriteId = 'male' | 'maleRear' | 'subadult' | 'female' | 'juvenile' | 'pup';

const SPRITES: Record<SpriteId, string[]> = {
  male: MALE,
  maleRear: MALE_REAR,
  subadult: SUBADULT,
  female: FEMALE,
  juvenile: JUVENILE,
  pup: PUP,
};

/** 体の中で「こぶ」を作る列の範囲（移動アニメ用） */
const HUMP: Record<SpriteId, [number, number]> = {
  male: [12, 24],
  maleRear: [9, 18],
  subadult: [8, 17],
  female: [6, 14],
  juvenile: [5, 11],
  pup: [3, 8],
};

export interface SpriteVariant {
  coat: CoatKey;
  collar: boolean;
  scars: boolean;
  frame: 0 | 1;
  flip: boolean;
}

/** たてがみの境目（この列より頭側が白くなる）と、たてがみが及ぶ最下行 */
const MANE: Partial<Record<SpriteId, { col: number; maxRow: number }>> = {
  male: { col: 15, maxRow: 12 },
  maleRear: { col: 14, maxRow: 9 },
  subadult: { col: 10, maxRow: 9 },
};

const cache = new Map<string, HTMLCanvasElement>();

function pad(rows: string[]): string[] {
  const w = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => r.padEnd(w, '.'));
}

export function spriteSize(id: SpriteId): { w: number; h: number } {
  const rows = SPRITES[id];
  return { w: Math.max(...rows.map((r) => r.length)), h: rows.length + 1 };
}

function colorFor(ch: string, coat: CoatKey, mane: boolean): string | null {
  const c = COATS[coat];
  if (mane) {
    const cream = coat === 'pale';
    switch (ch) {
      case 'd': case 'n': return cream ? P.skin0 : P.gray0;
      case 'b': return cream ? P.sand0 : P.white;
      case 'h': return P.white;
    }
  }
  switch (ch) {
    case 'o': return c.o;
    case 'd': return c.d;
    case 'b': return c.b;
    case 'h': return c.h;
    case 'e': return P.ink;
    case 'w': return coat === 'pale' ? P.sand0 : P.gray0;
    case 'n': return coat === 'pale' ? P.gray1 : c.d;
    default: return null;
  }
}

/** 毛色・襟・傷・コマ・向きごとにキャンバスを作ってキャッシュする */
export function getSprite(id: SpriteId, v: SpriteVariant): HTMLCanvasElement {
  const key = `${id}|${v.coat}|${v.collar ? 1 : 0}|${v.scars ? 1 : 0}|${v.frame}|${v.flip ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rows = pad(SPRITES[id]);
  const w = rows[0].length;
  const h = rows.length + 1; // こぶの分 1px 余白
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  const [h0, h1] = HUMP[id];
  const mane = v.collar ? MANE[id] : undefined;
  for (let y = 0; y < rows.length; y++) {
    // たてがみの境目は行ごとに少し揺らして、ふさふさに見せる
    const edge = mane ? mane.col + ((y * 7) % 3) - 1 : -1;
    for (let x = 0; x < w; x++) {
      const inMane = !!mane && y <= mane.maxRow && x < edge;
      const col = colorFor(rows[y][x], v.coat, inMane);
      if (!col) continue;
      const lift = v.frame === 1 && x >= h0 && x <= h1 ? 1 : 0;
      const px = v.flip ? w - 1 - x : x;
      ctx.fillStyle = col;
      ctx.fillRect(px, y + 1 - lift, 1, 1);
      // こぶで持ち上がった列の下を地の色で埋める
      if (lift && y === rows.length - 1) {
        ctx.fillStyle = col;
        ctx.fillRect(px, y + 1, 1, 1);
      }
    }
  }
  if (v.scars) {
    // 首まわりの古傷（ピンクの線）
    ctx.fillStyle = P.pink1;
    const sx = Math.floor(w * 0.28);
    const marks = [[0, 0], [1, 1], [2, 0], [3, 1]];
    for (const [dx, dy] of marks) {
      const x = sx + dx;
      ctx.fillRect(v.flip ? w - 1 - x : x, Math.floor(rows.length * 0.45) + dy + 1, 1, 1);
    }
  }
  cache.set(key, cv);
  return cv;
}

const outlineCache = new WeakMap<HTMLCanvasElement, Map<string, HTMLCanvasElement>>();

/** スプライトの外側を 1px 縁取ったシルエット（自分・選択中の目印） */
export function getOutline(sp: HTMLCanvasElement, color: string): HTMLCanvasElement {
  let m = outlineCache.get(sp);
  if (!m) outlineCache.set(sp, (m = new Map()));
  const hit = m.get(color);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = sp.width + 2;
  cv.height = sp.height + 2;
  const ctx = cv.getContext('2d')!;
  for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) ctx.drawImage(sp, dx, dy);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, cv.width, cv.height);
  m.set(color, cv);
  return cv;
}

// ─────────────────────────────────────────────
// 小さなアイコン（吹き出し・印）
// ─────────────────────────────────────────────

export type IconId = 'heart' | 'bang' | 'sweat' | 'note' | 'sparkle' | 'anger' | 'zzz' | 'crown' | 'arrow' | 'dot' | 'cross' | 'plus' | 'skull' | 'scheme' | 'dots';

const ICONS: Record<IconId, { rows: string[]; colors: Record<string, string> }> = {
  heart: { rows: ['.r.r.', 'rrrrr', 'rrrrr', '.rrr.', '..r..'], colors: { r: P.red1 } },
  bang: { rows: ['.r.', '.r.', '.r.', '...', '.r.'], colors: { r: P.red1 } },
  sweat: { rows: ['..b..', '.bb..', 'bbbb.', 'bcbb.', '.bb..'], colors: { b: P.blue1, c: P.cyan } },
  note: { rows: ['..kk', '..kk', '..k.', 'kkk.', 'kk..'], colors: { k: P.ink } },
  sparkle: { rows: ['..y..', '.yyy.', 'yywyy', '.yyy.', '..y..'], colors: { y: P.gold1, w: P.white } },
  anger: { rows: ['r.r.r', '.r.r.', 'r...r', '.r.r.', 'r.r.r'], colors: { r: P.red1 } },
  zzz: { rows: ['kkk..', '..k..', '.k...', 'kkk..', '...kk'], colors: { k: P.gray2 } },
  crown: { rows: ['y.y.y', 'yyyyy', 'yrryy', 'yyyyy'], colors: { y: P.gold0, r: P.red1 } },
  arrow: { rows: ['kkkkkkk', 'kyyyyyk', '.kyyyk.', '..kyk..', '...k...'], colors: { y: P.gold1, k: P.ink } },
  dot: { rows: ['rr', 'rr'], colors: { r: P.red1 } },
  cross: { rows: ['k...k', '.k.k.', '..k..', '.k.k.', 'k...k'], colors: { k: P.ink } },
  plus: { rows: ['.g.', 'ggg', '.g.'], colors: { g: P.green0 } },
  skull: { rows: ['.www.', 'wkwkw', 'wwwww', '.w.w.'], colors: { w: P.gray0, k: P.ink } },
  scheme: { rows: ['kk.kk', 'wk.wk', '.....', 'k...k', '.kkk.'], colors: { k: P.plum, w: P.white } },
  dots: { rows: ['.....', '.....', 'k.k.k', '.....', '.....'], colors: { k: P.gray2 } },
};

const iconCache = new Map<string, HTMLCanvasElement>();

export function getIcon(id: IconId): HTMLCanvasElement {
  const hit = iconCache.get(id);
  if (hit) return hit;
  const { rows, colors } = ICONS[id];
  const cv = document.createElement('canvas');
  cv.width = Math.max(...rows.map((r) => r.length));
  cv.height = rows.length;
  const ctx = cv.getContext('2d')!;
  rows.forEach((r, y) =>
    [...r].forEach((ch, x) => {
      const c = colors[ch];
      if (!c) return;
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    }),
  );
  iconCache.set(id, cv);
  return cv;
}

/** 吹き出し（11×9）にアイコンを入れたもの */
export function getBubble(icon: IconId): HTMLCanvasElement {
  const key = `bubble|${icon}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const rows = [
    '.ooooooooo.',
    'owwwwwwwwwo',
    'owwwwwwwwwo',
    'owwwwwwwwwo',
    'owwwwwwwwwo',
    'owwwwwwwwwo',
    'owwwwwwwwwo',
    '.oooowoooo.',
    '....owo....',
    '.....o.....',
  ];
  const cv = document.createElement('canvas');
  cv.width = 11;
  cv.height = rows.length;
  const ctx = cv.getContext('2d')!;
  rows.forEach((r, y) =>
    [...r].forEach((ch, x) => {
      if (ch === '.') return;
      ctx.fillStyle = ch === 'o' ? P.ink : P.white;
      ctx.fillRect(x, y, 1, 1);
    }),
  );
  const ic = getIcon(icon);
  ctx.drawImage(ic, Math.floor((11 - ic.width) / 2), 1 + Math.floor((6 - ic.height) / 2));
  iconCache.set(key, cv);
  return cv;
}
