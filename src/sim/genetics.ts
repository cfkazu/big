import { Rng } from './rng';

// ─────────────────────────────────────────────
// 染色体と遺伝子座
// 二倍体。常染色体3対＋性染色体（XX / XY）。
// 位置は cM（センチモルガン）。減数分裂では Haldane の写像関数（乗換え＝ポアソン過程）で組換えを起こす。
// ─────────────────────────────────────────────

export type ChromId = 'A1' | 'A2' | 'A3' | 'X' | 'Y';

export const CHROM_LENGTH_CM: Record<ChromId, number> = {
  A1: 120,
  A2: 110,
  A3: 90,
  X: 100,
  Y: 0, // 非組換え
};

export const AUTOSOMES: ChromId[] = ['A1', 'A2', 'A3'];

export type LocusKind = 'quant' | 'deleterious' | 'tactic' | 'coat';

export interface LocusDef {
  id: string;
  chrom: ChromId;
  pos: number;
  kind: LocusKind;
  trait?: TraitId;
  /** 量的形質：1 回の突然変異で加わる効果の標準偏差 */
  mutSd?: number;
  /** 量的形質：創始集団での対立遺伝子効果の標準偏差 */
  initSd?: number;
}

export type TraitId = 'hoko' | 'body' | 'testis' | 'pref' | 'aggression' | 'boldness' | 'hubris';

// 戦略スーパージーン（エリマキシギの逆位がモデル）
// R：主型（劣性）。S / F は R に対して優性で、S・F を 2 本持つ組み合わせは胚致死。
export const TACTIC_R = 0;
export const TACTIC_S = 1;
export const TACTIC_F = 2;

// 毛色：B（茶）> G（灰）> P（淡）の完全優性系列
export const COAT_B = 0;
export const COAT_G = 1;
export const COAT_P = 2;

export type Tactic = 'R' | 'S' | 'F';
export type Coat = 'brown' | 'gray' | 'pale';

const L: LocusDef[] = [
  // ホコ：常染色体の 3 座位＋Y 連鎖の修飾座位（父から息子にだけ伝わる）
  { id: 'HOKO1', chrom: 'A1', pos: 12, kind: 'quant', trait: 'hoko', mutSd: 1.0, initSd: 2.4 },
  { id: 'HOKO2', chrom: 'A2', pos: 22, kind: 'quant', trait: 'hoko', mutSd: 1.0, initSd: 2.4 },
  { id: 'HOKO3', chrom: 'A3', pos: 16, kind: 'quant', trait: 'hoko', mutSd: 1.0, initSd: 2.4 },
  { id: 'HOKOY', chrom: 'Y', pos: 0, kind: 'quant', trait: 'hoko', mutSd: 0.6, initSd: 1.6 },
  // 体格
  { id: 'BODY1', chrom: 'A1', pos: 34, kind: 'quant', trait: 'body', mutSd: 0.02, initSd: 0.045 },
  { id: 'BODY2', chrom: 'A3', pos: 52, kind: 'quant', trait: 'body', mutSd: 0.02, initSd: 0.045 },
  // 精巣：ホコの座位と強く連鎖させた座位を置き、遺伝的トレードオフの「しがらみ」を作る
  { id: 'TES1', chrom: 'A2', pos: 27, kind: 'quant', trait: 'testis', mutSd: 18, initSd: 40 },
  { id: 'TES2', chrom: 'A3', pos: 38, kind: 'quant', trait: 'testis', mutSd: 18, initSd: 40 },
  { id: 'TESX', chrom: 'X', pos: 40, kind: 'quant', trait: 'testis', mutSd: 12, initSd: 25 },
  // 戦略スーパージーン（逆位なので 1 座位として扱う）
  { id: 'TACTIC', chrom: 'A2', pos: 64, kind: 'tactic' },
  // 毛色
  { id: 'COAT', chrom: 'A1', pos: 58, kind: 'coat' },
  // メスの好み（ホコの大きさをどれだけ重視するか）
  { id: 'PREF1', chrom: 'A1', pos: 18, kind: 'quant', trait: 'pref', mutSd: 0.05, initSd: 0.1 },
  { id: 'PREF2', chrom: 'A3', pos: 66, kind: 'quant', trait: 'pref', mutSd: 0.05, initSd: 0.1 },
  // 気質
  { id: 'AGG1', chrom: 'A2', pos: 88, kind: 'quant', trait: 'aggression', mutSd: 0.05, initSd: 0.11 },
  { id: 'AGG2', chrom: 'X', pos: 72, kind: 'quant', trait: 'aggression', mutSd: 0.05, initSd: 0.11 },
  { id: 'BOLD1', chrom: 'A3', pos: 78, kind: 'quant', trait: 'boldness', mutSd: 0.05, initSd: 0.11 },
  { id: 'BOLD2', chrom: 'A1', pos: 96, kind: 'quant', trait: 'boldness', mutSd: 0.05, initSd: 0.11 },
  { id: 'HUBRIS', chrom: 'A2', pos: 100, kind: 'quant', trait: 'hubris', mutSd: 0.03, initSd: 0.05 },
];

// 有害劣性突然変異の座位（近交弱勢の源）。各染色体に散らばらせる。
const DEL_LAYOUT: [ChromId, number][] = [
  ['A1', 6], ['A1', 26], ['A1', 46], ['A1', 70], ['A1', 84], ['A1', 110],
  ['A2', 8], ['A2', 40], ['A2', 52], ['A2', 76], ['A2', 96],
  ['A3', 4], ['A3', 28], ['A3', 46], ['A3', 60], ['A3', 86],
  ['X', 10], ['X', 30], ['X', 58], ['X', 88],
];
DEL_LAYOUT.forEach(([chrom, pos], i) => {
  L.push({ id: `DEL${i + 1}`, chrom, pos, kind: 'deleterious' });
});

export const LOCI: readonly LocusDef[] = L;

/** 染色体ごとの座位（位置順） */
export const LOCI_BY_CHROM: Record<ChromId, LocusDef[]> = { A1: [], A2: [], A3: [], X: [], Y: [] };
for (const l of L) LOCI_BY_CHROM[l.chrom].push(l);
for (const c of Object.keys(LOCI_BY_CHROM) as ChromId[]) LOCI_BY_CHROM[c].sort((a, b) => a.pos - b.pos);

export const LOCUS_INDEX: Record<string, { chrom: ChromId; idx: number }> = {};
for (const c of Object.keys(LOCI_BY_CHROM) as ChromId[]) {
  LOCI_BY_CHROM[c].forEach((l, idx) => (LOCUS_INDEX[l.id] = { chrom: c, idx }));
}

// ─────────────────────────────────────────────
// 遺伝子型
// ─────────────────────────────────────────────

/** 1 本の染色体上の対立遺伝子の並び */
export type Haplotype = number[];

export interface Genome {
  sex: 'M' | 'F';
  /** 常染色体：各染色体について [母由来, 父由来] */
  auto: Record<'A1' | 'A2' | 'A3', [Haplotype, Haplotype]>;
  /** オス：[X(母由来), Y(父由来)]、メス：[X(母由来), X(父由来)] */
  sex1: Haplotype;
  sex2: Haplotype;
}

export interface Gamete {
  auto: Record<'A1' | 'A2' | 'A3', Haplotype>;
  sexChrom: Haplotype;
  /** 精子のみ：Y を運ぶか */
  carriesY: boolean;
}

export const MUTATION = {
  /** 量的座位：配偶子あたり・座位あたりの突然変異率 */
  quantRate: 0.008,
  /** 有害座位：正常 → 有害の突然変異率 */
  delRate: 0.0025,
  /** 有害座位：有害 → 正常（復帰突然変異） */
  delBackRate: 0.0002,
};

/** 有害突然変異の効果：選択係数 s とヘテロ接合での優性度 h */
export const DEL_S = 0.09;
export const DEL_H = 0.12;

function mutateHaplotype(h: Haplotype, chrom: ChromId, rng: Rng): void {
  const loci = LOCI_BY_CHROM[chrom];
  for (let i = 0; i < loci.length; i++) {
    const l = loci[i];
    if (l.kind === 'quant') {
      if (rng.chance(MUTATION.quantRate)) h[i] += rng.normal(0, l.mutSd ?? 1);
    } else if (l.kind === 'deleterious') {
      if (h[i] === 0 && rng.chance(MUTATION.delRate)) h[i] = 1;
      else if (h[i] === 1 && rng.chance(MUTATION.delBackRate)) h[i] = 0;
    }
    // 戦略・毛色は突然変異させない（逆位は滅多に新生しない）
  }
}

/**
 * 相同染色体の組から、乗換えを経た 1 本を作る。
 * 乗換え数 ~ Poisson(長さ[M])、位置は一様（Haldane：干渉なし）。
 */
export function recombine(h1: Haplotype, h2: Haplotype, chrom: ChromId, rng: Rng): Haplotype {
  const loci = LOCI_BY_CHROM[chrom];
  const len = CHROM_LENGTH_CM[chrom];
  const n = rng.poisson(len / 100);
  const points: number[] = [];
  for (let i = 0; i < n; i++) points.push(rng.next() * len);
  points.sort((a, b) => a - b);
  let strand = rng.chance(0.5) ? 0 : 1;
  let p = 0;
  const out: Haplotype = new Array(loci.length);
  for (let i = 0; i < loci.length; i++) {
    while (p < points.length && points[p] < loci[i].pos) {
      strand ^= 1;
      p++;
    }
    out[i] = strand === 0 ? h1[i] : h2[i];
  }
  return out;
}

export function makeGamete(g: Genome, rng: Rng): Gamete {
  const auto = {
    A1: recombine(g.auto.A1[0], g.auto.A1[1], 'A1', rng),
    A2: recombine(g.auto.A2[0], g.auto.A2[1], 'A2', rng),
    A3: recombine(g.auto.A3[0], g.auto.A3[1], 'A3', rng),
  };
  let sexChrom: Haplotype;
  let carriesY = false;
  if (g.sex === 'F') {
    sexChrom = recombine(g.sex1, g.sex2, 'X', rng);
  } else if (rng.chance(0.5)) {
    sexChrom = g.sex1.slice(); // X
  } else {
    sexChrom = g.sex2.slice(); // Y
    carriesY = true;
  }
  mutateHaplotype(auto.A1, 'A1', rng);
  mutateHaplotype(auto.A2, 'A2', rng);
  mutateHaplotype(auto.A3, 'A3', rng);
  mutateHaplotype(sexChrom, carriesY ? 'Y' : 'X', rng);
  return { auto, sexChrom, carriesY };
}

/** 受精：卵（母）＋精子（父）→ 胚のゲノム。性は精子が決める。 */
export function fertilize(egg: Gamete, sperm: Gamete): Genome {
  return {
    sex: sperm.carriesY ? 'M' : 'F',
    auto: {
      A1: [egg.auto.A1, sperm.auto.A1],
      A2: [egg.auto.A2, sperm.auto.A2],
      A3: [egg.auto.A3, sperm.auto.A3],
    },
    sex1: egg.sexChrom,
    sex2: sperm.sexChrom,
  };
}

// ─────────────────────────────────────────────
// 遺伝子型の読み出し
// ─────────────────────────────────────────────

/** その座位の対立遺伝子の組（Y 連鎖などで片方しかなければ 1 つ） */
export function allelesAt(g: Genome, locusId: string): number[] {
  const { chrom, idx } = LOCUS_INDEX[locusId];
  if (chrom === 'A1' || chrom === 'A2' || chrom === 'A3') {
    return [g.auto[chrom][0][idx], g.auto[chrom][1][idx]];
  }
  if (chrom === 'X') {
    return g.sex === 'F' ? [g.sex1[idx], g.sex2[idx]] : [g.sex1[idx]];
  }
  // Y
  return g.sex === 'M' ? [g.sex2[idx]] : [];
}

/** 相加的遺伝子型値（その形質に効く全座位の対立遺伝子の和） */
export function additiveValue(g: Genome, trait: TraitId): number {
  let sum = 0;
  for (const l of LOCI) {
    if (l.trait !== trait) continue;
    const a = allelesAt(g, l.id);
    // X 連鎖座位はオスでは 1 コピーしかないので、量的効果を 2 倍にして補償する（遺伝子量補償）
    if (l.chrom === 'X' && g.sex === 'M') sum += a[0] * 2;
    else for (const v of a) sum += v;
  }
  return sum;
}

/** 有害突然変異による活力（1 = 健全）。ホモ接合で s、ヘテロ接合で h·s だけ減る。 */
export function vigorOf(g: Genome): number {
  let w = 1;
  for (const l of LOCI) {
    if (l.kind !== 'deleterious') continue;
    const a = allelesAt(g, l.id);
    const count = a[0] + (a[1] ?? 0);
    if (a.length === 1) {
      // オスの X：ヘミ接合なので劣性でも発現
      if (a[0] === 1) w *= 1 - DEL_S;
    } else if (count === 2) w *= 1 - DEL_S;
    else if (count === 1) w *= 1 - DEL_H * DEL_S;
  }
  return w;
}

export function homozygousDeleteriousCount(g: Genome): number {
  let n = 0;
  for (const l of LOCI) {
    if (l.kind !== 'deleterious') continue;
    const a = allelesAt(g, l.id);
    if (a.length === 2 ? a[0] === 1 && a[1] === 1 : a[0] === 1) n++;
  }
  return n;
}

export function deleteriousLoad(g: Genome): number {
  let n = 0;
  for (const l of LOCI) {
    if (l.kind !== 'deleterious') continue;
    for (const v of allelesAt(g, l.id)) n += v;
  }
  return n;
}

/** 戦略スーパージーン。致死の組み合わせなら null。 */
export function tacticOf(g: Genome): Tactic | null {
  const [a, b] = allelesAt(g, 'TACTIC');
  const nonR = (a !== TACTIC_R ? 1 : 0) + (b !== TACTIC_R ? 1 : 0);
  if (nonR === 2) return null; // 逆位ホモ接合は致死
  if (nonR === 0) return 'R';
  return a === TACTIC_S || b === TACTIC_S ? 'S' : 'F';
}

export function coatOf(g: Genome): Coat {
  const [a, b] = allelesAt(g, 'COAT');
  const top = Math.min(a, b); // 番号の小さい方が優性
  return top === COAT_B ? 'brown' : top === COAT_G ? 'gray' : 'pale';
}

export function tacticAlleleName(v: number): string {
  return v === TACTIC_R ? 'r' : v === TACTIC_S ? 'S' : 'F';
}

export function coatAlleleName(v: number): string {
  return v === COAT_B ? 'B' : v === COAT_G ? 'g' : 'p';
}

// ─────────────────────────────────────────────
// 創始集団
// ─────────────────────────────────────────────

export interface FounderFreqs {
  tacticS: number;
  tacticF: number;
  coatG: number;
  coatP: number;
  del: number;
}

export const DEFAULT_FOUNDER_FREQS: FounderFreqs = {
  tacticS: 0.08,
  tacticF: 0.04,
  coatG: 0.3,
  coatP: 0.25,
  del: 0.06,
};

function randomHaplotype(chrom: ChromId, rng: Rng, f: FounderFreqs): Haplotype {
  return LOCI_BY_CHROM[chrom].map((l) => {
    switch (l.kind) {
      case 'quant':
        return rng.normal(0, l.initSd ?? 1);
      case 'deleterious':
        return rng.chance(f.del) ? 1 : 0;
      case 'tactic': {
        const r = rng.next();
        return r < f.tacticS ? TACTIC_S : r < f.tacticS + f.tacticF ? TACTIC_F : TACTIC_R;
      }
      case 'coat': {
        const r = rng.next();
        return r < f.coatP ? COAT_P : r < f.coatP + f.coatG ? COAT_G : COAT_B;
      }
    }
  });
}

export function randomGenome(sex: 'M' | 'F', rng: Rng, f: FounderFreqs = DEFAULT_FOUNDER_FREQS): Genome {
  const pair = (c: ChromId): [Haplotype, Haplotype] => [randomHaplotype(c, rng, f), randomHaplotype(c, rng, f)];
  return {
    sex,
    auto: { A1: pair('A1'), A2: pair('A2'), A3: pair('A3') },
    sex1: randomHaplotype('X', rng, f),
    sex2: sex === 'F' ? randomHaplotype('X', rng, f) : randomHaplotype('Y', rng, f),
  };
}
