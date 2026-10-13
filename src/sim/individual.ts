import {
  additiveValue,
  coatOf,
  deleteriousLoad,
  homozygousDeleteriousCount,
  tacticOf,
  vigorOf,
  type Coat,
  type Genome,
  type Tactic,
} from './genetics';
import type { Rng } from './rng';

export interface SpermDeposit {
  maleId: number;
  /** 億匹 */
  amount: number;
  day: number;
}

export interface Pregnancy {
  fatherId: number;
  genome: Genome;
  conceivedYear: number;
}

export interface Thought {
  text: string;
  year: number;
  day: number;
  mood: 'happy' | 'sad' | 'angry' | 'neutral' | 'love' | 'scheme';
  /** どの場面のセリフか（ThoughtKey） */
  key?: string;
  /** 誰について言ったか */
  aboutId?: number;
  /** 差し込み前の元の文 */
  raw?: string;
}

export type DeathCause = 'old' | 'orca' | 'starve' | 'wound' | 'sick' | 'frail' | 'crushed' | 'orphan' | 'weak';

/** 遺伝子型と発生ノイズで決まり、一生変わらない基礎値 */
export interface BasePhenotype {
  /** 成熟時のホコの基本長（cm） */
  hoko: number;
  /** 成熟時の体重（kg） */
  body: number;
  /** 成熟時の精巣重量（g、左右合計） */
  testis: number;
  pref: number;
  aggression: number;
  boldness: number;
  hubris: number;
  vigor: number;
  delLoad: number;
  delHomo: number;
  coat: Coat;
  tactic: Tactic;
}

export class Individual {
  id: number;
  name: string;
  genome: Genome;
  sex: 'M' | 'F';
  motherId: number | null;
  fatherId: number | null;
  birthYear: number;
  base: BasePhenotype;

  alive = true;
  deathYear: number | null = null;
  deathCause: DeathCause | null = null;

  /** 脂肪の蓄え（0〜1） */
  condition = 0.6;
  /** 繁殖期の始まりの体力。ホコの張りはこれで決まり、期間中の絶食では縮まない。 */
  seasonCondition = 0.6;
  /** ケガ（0〜1） */
  injury = 0;
  /** 貯精量（億匹） */
  sperm = 0;
  /** ホコのツヤ（手入れによる見せ方の上乗せ、0〜0.12） */
  shine = 0;
  /** 序列のレーティング */
  elo = 1000;

  // 繁殖期の状態
  onBeach = false;
  /** ハーレム枠（オス：主として持つ枠、メス：滞在中の枠、S：従う枠、F：紛れ込む枠） */
  slot: number | null = null;
  /** 今いる枠の主への愛着（メス） */
  loyalty = 0;
  estrusStart = -1;
  birthDay = -1;
  spermStore: SpermDeposit[] = [];
  pregnancy: Pregnancy | null = null;
  pupId: number | null = null;
  /** 今日すでに争ったか */
  foughtToday = false;
  /** 最後に負けた日（負けた直後は挑む気が失せる：敗者効果） */
  lastLossDay = -99;
  /** 繁殖期中の通算 */
  season = { matings: 0, displaysWon: 0, displaysLost: 0, fightsWon: 0, fightsLost: 0, groomed: 0, peakHarem: 0 };

  // 生涯
  lifetime = { matings: 0, holderSeasons: 0, displaysWon: 0, fightsWon: 0 };
  childIds: number[] = [];
  /** 創始個体（プレイヤーの初代）由来のゲノムの期待割合 */
  dynasty = 0;

  thought: Thought | null = null;
  /** 最近言ったセリフの元の文（同じことを繰り返さないため） */
  recentLines: string[] = [];
  /** 場面ごとに最後につぶやいた日（year*100+day） */
  keyDay: Record<string, number> = {};
  /** よその浜からの移入個体 */
  immigrant = false;
  /** 懐きやすさ（0〜1、生まれつき） */
  warmth = 0.5;
  /** 去年の繁殖期の終わりに身を寄せていた主（メス） */
  lastHolderId: number | null = null;

  constructor(opts: {
    id: number;
    name: string;
    genome: Genome;
    motherId: number | null;
    fatherId: number | null;
    birthYear: number;
    rng: Rng;
  }) {
    this.id = opts.id;
    this.name = opts.name;
    this.genome = opts.genome;
    this.sex = opts.genome.sex;
    this.motherId = opts.motherId;
    this.fatherId = opts.fatherId;
    this.birthYear = opts.birthYear;
    this.base = computeBase(opts.genome, opts.rng);
    this.warmth = opts.rng.next();
  }

  ageAt(year: number): number {
    return year - this.birthYear;
  }
}

export function computeBase(g: Genome, rng: Rng): BasePhenotype {
  const tactic = tacticOf(g) ?? 'R';
  const male = g.sex === 'M';
  const vigor = vigorOf(g);

  let hoko = 0;
  let testis = 0;
  if (male) {
    hoko = 34 + additiveValue(g, 'hoko') + rng.normal(0, 1.3);
    // 精巣：オスにだけ発現。X 連鎖成分を含む。
    testis = 330 + additiveValue(g, 'testis') + rng.normal(0, 15);
    // 戦略型ごとの発生の切り替え（エリマキシギの faeder は精巣が大きく、体が小さい）
    if (tactic === 'S') {
      hoko *= 0.82;
      testis *= 1.25;
    } else if (tactic === 'F') {
      hoko *= 0.38;
      testis *= 1.75;
    }
    hoko = Math.max(6, hoko);
    testis = Math.max(60, testis);
  }
  let bodyMul = 1 + additiveValue(g, 'body') + rng.normal(0, 0.03);
  if (male && tactic === 'F') bodyMul *= 0.62;
  else if (male && tactic === 'S') bodyMul *= 0.9;
  const body = (male ? 1500 : 560) * Math.max(0.6, bodyMul);

  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  return {
    hoko,
    body,
    testis,
    pref: clamp01(0.5 + additiveValue(g, 'pref')),
    aggression: clamp01(0.5 + additiveValue(g, 'aggression')),
    boldness: clamp01(0.5 + additiveValue(g, 'boldness')),
    hubris: Math.min(0.3, Math.max(-0.2, additiveValue(g, 'hubris'))),
    vigor,
    delLoad: deleteriousLoad(g),
    delHomo: homozygousDeleteriousCount(g),
    coat: coatOf(g),
    tactic,
  };
}

// ─────────────────────────────────────────────
// 年齢と状態に依存する表現型
// ─────────────────────────────────────────────

/** 成長曲線：0 歳 → 成熟年齢で 1。高齢でゆるやかに衰える。 */
function growth(age: number, matureAge: number, startFrac: number): number {
  if (age >= matureAge) return 1;
  return startFrac + (1 - startFrac) * (age / matureAge);
}

function senescence(age: number, onset: number, rate: number): number {
  return age <= onset ? 1 : Math.max(0.5, 1 - (age - onset) * rate);
}

export function bodyMass(ind: Individual, year: number): number {
  const age = ind.ageAt(year);
  const g = ind.sex === 'M' ? growth(age, 8, 0.12) : growth(age, 4, 0.2);
  return ind.base.body * g * (0.8 + 0.2 * ind.condition);
}

/** ホコの張り（0.55〜1）。繁殖期の始まりの脂肪で決まる。採餌期のあいだは今の脂肪で見込む。 */
export function hokoFirmness(ind: Individual, current = false): number {
  return 0.55 + 0.45 * (current ? ind.condition : ind.seasonCondition);
}

/** 見せ合いで見えるホコの長さ（cm）。遺伝 × 年齢 × コンディション × 活力 × ツヤ。 */
export function hokoDisplay(ind: Individual, year: number): number {
  if (ind.sex !== 'M') return 0;
  const age = ind.ageAt(year);
  const g = growth(age, 7, 0.25) * senescence(age, 12, 0.04);
  const cond = hokoFirmness(ind);
  const vig = 0.85 + 0.15 * ind.base.vigor;
  return ind.base.hoko * g * cond * vig * (1 + ind.shine);
}

/** 精巣重量（g）。4 歳で精子形成が始まり、6 歳で成熟。 */
export function testisMass(ind: Individual, year: number): number {
  if (ind.sex !== 'M') return 0;
  const age = ind.ageAt(year);
  if (age < 3) return ind.base.testis * 0.05;
  return ind.base.testis * growth(age, 6, 0.3) * senescence(age, 13, 0.05);
}

export const SPERM = {
  /** 精巣 1 g・1 日あたりの精子産生（億匹） */
  dailyPerGram: 0.15,
  /** 精巣上体の貯精容量：精巣 1 g あたり（億匹） */
  capacityPerGram: 0.6,
  /** 1 回の射精で放出される貯精量の割合 */
  ejaculateFrac: 0.4,
  /** 雌の生殖道内での精子の 1 日あたり生存率 */
  survivalPerDay: 0.8,
  /** 受精の起こりやすさ（この量で約 63%） */
  fertilizationScale: 15,
};

export function spermCapacity(ind: Individual, year: number): number {
  if (ind.ageAt(year) < 4) return 0;
  return testisMass(ind, year) * SPERM.capacityPerGram;
}

export function spermDaily(ind: Individual, year: number): number {
  if (ind.ageAt(year) < 4) return 0;
  return testisMass(ind, year) * SPERM.dailyPerGram * (0.5 + 0.5 * ind.condition) * ind.base.vigor;
}

/** 取っ組み合いの強さ */
export function fightPower(ind: Individual, year: number): number {
  return (
    bodyMass(ind, year) *
    (0.45 + 0.55 * ind.condition) *
    (1 - 0.6 * ind.injury) *
    (0.8 + 0.4 * ind.base.aggression) *
    (0.9 + 0.1 * ind.base.vigor)
  );
}

export function isAdultFemale(ind: Individual, year: number): boolean {
  return ind.sex === 'F' && ind.ageAt(year) >= 3;
}

export function isBreedingMale(ind: Individual, year: number): boolean {
  return ind.sex === 'M' && ind.ageAt(year) >= 4;
}

export function tacticLabel(t: Tactic): string {
  return t === 'R' ? '主型' : t === 'S' ? '衛星型' : '忍び型';
}

export function coatLabel(c: Coat): string {
  return c === 'brown' ? '茶' : c === 'gray' ? '灰' : '淡';
}
