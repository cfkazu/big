import type { Rng } from './rng';

const MALE_HEAD = [
  'ゴン', 'ドス', 'ブン', 'ガン', 'ザブ', 'モン', 'ボウ', 'ダイ', 'ゲン', 'グン',
  'タケ', 'ムサ', 'ドン', 'ガブ', 'ベン', 'ジン', 'ゴウ', 'リキ', 'テツ', 'ヌマ',
  'オボ', 'ズン', 'バク', 'カン', 'ヨシ', 'トラ', 'クマ', 'ハチ', 'ブチ', 'ゼン',
];
const MALE_TAIL = ['タ', 'スケ', 'マル', 'ゾウ', 'ジ', 'ベエ', 'キチ', 'ロウ', 'ノシン', 'ザエモン', 'エモン', 'ゴロウ', 'ヘイ', 'ゾー'];

const FEMALE_HEAD = [
  'ミナ', 'シオ', 'ウラ', 'ハマ', 'ナギ', 'ユラ', 'サザ', 'コノ', 'アワ', 'スズ',
  'モモ', 'フネ', 'タマ', 'イソ', 'ミオ', 'カモ', 'ツユ', 'ヒナ', 'ノリ', 'アユ',
  'マリ', 'ルリ', 'ホタ', 'サヨ', 'チヨ', 'オト', 'ミツ', 'ウミ', 'ナミ', 'キヌ',
];
const FEMALE_TAIL = ['モ', 'リ', 'ラ', 'ネ', 'コ', 'エ', 'ノ', '', 'カ', 'ヨ', 'ミ', 'ホ'];

export function randomName(sex: 'M' | 'F', rng: Rng, taken: Set<string>): string {
  for (let tries = 0; tries < 40; tries++) {
    const n = sex === 'M' ? rng.pick(MALE_HEAD) + rng.pick(MALE_TAIL) : rng.pick(FEMALE_HEAD) + rng.pick(FEMALE_TAIL);
    if (!taken.has(n)) return n;
  }
  // 名前が尽きたら代を付ける
  const base = sex === 'M' ? rng.pick(MALE_HEAD) + rng.pick(MALE_TAIL) : rng.pick(FEMALE_HEAD) + rng.pick(FEMALE_TAIL);
  for (let k = 2; k < 99; k++) {
    const n = `${base}${toKanjiNum(k)}世`;
    if (!taken.has(n)) return n;
  }
  return base;
}

/** 血統の跡継ぎの名前：親の名前＋代 */
export function heirName(founderName: string, generation: number): string {
  return generation <= 1 ? founderName : `${founderName}${toKanjiNum(generation)}世`;
}

export function toKanjiNum(n: number): string {
  const d = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  if (n < 10) return d[n];
  if (n < 20) return '十' + d[n - 10];
  return d[Math.floor(n / 10)] + '十' + d[n % 10];
}
