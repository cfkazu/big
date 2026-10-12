import { additiveValue } from './genetics';
import type { Individual } from './individual';

// 世代をまたいだ「進歩」を見せるための指標

/**
 * 主型のオスとして育ったときのホコの遺伝的な長さ（cm）。
 * 戦略型や発生の揺らぎを除いた、遺伝子だけで決まる値。メスでも計算でき、息子に伝わる素質の目安になる。
 */
export function geneticHoko(ind: Individual): number {
  return 34 + additiveValue(ind.genome, 'hoko');
}

/** 成熟したときのホコの長さ（cm）。オスは実際の素質、メスは遺伝的な値。 */
export function hokoPotential(ind: Individual): number {
  return ind.sex === 'M' ? ind.base.hoko : geneticHoko(ind);
}

/** 群れの平均と比べた素質の星（1〜5） */
export function potentialStars(value: number, herdMean: number): number {
  const z = (value - herdMean) / 5;
  return Math.max(1, Math.min(5, Math.round(3 + z * 1.4)));
}

export function starText(n: number): string {
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

/**
 * メスの「血筋の見立て」。メスのホコは見えないので、父と兄弟（主型として育った値）から推す。
 * 手がかりがなければ null。
 */
export function bloodEstimate(f: Individual, get: (id: number | null) => Individual | undefined, all: Iterable<Individual>): { value: number; clues: string[] } | null {
  const kin: { ind: Individual; label: string }[] = [];
  const father = get(f.fatherId);
  if (father) kin.push({ ind: father, label: `父${father.name}` });
  for (const i of all) {
    if (i.id === f.id || i.sex !== 'M' || i.fatherId == null) continue;
    if (i.fatherId === f.fatherId && i.motherId === f.motherId) kin.push({ ind: i, label: `兄弟${i.name}` });
  }
  if (kin.length === 0) return null;
  const value = kin.reduce((s, k) => s + geneticHoko(k.ind), 0) / kin.length;
  return { value, clues: kin.slice(0, 3).map((k) => k.label) };
}
