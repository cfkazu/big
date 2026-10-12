// 主の在任日数と、一繁殖期あたりの浜の奪い合いの回数を測る
// 使い方: npm run tenure -- [seed] [years]
import { BREED_DAYS, World } from '../src/sim/world';

const seed = Number(process.argv[2] ?? 3);
const years = Number(process.argv[3] ?? 10);
const w = World.create(seed, 30);
const tenures: number[] = [];
let takeovers = 0;
let abandons = 0;
let fullSeason = 0;
let holderSlots = 0;
for (let y = 0; y < years; y++) {
  w.startBreedingSeason();
  const since = new Map<number, number>();
  for (const id of w.slotHolders) if (id != null) since.set(id, 0);
  const initial = new Set(since.keys());
  for (let d = 0; d < BREED_DAYS; d++) {
    const g = w.runDay();
    let r = g.next();
    while (!r.done) r = g.next(w.aiAnswer(r.value));
    for (const e of w.dayEvents) {
      if (e.kind === 'takeover') {
        if (e.oldId != null) {
          takeovers++;
          tenures.push(d - (since.get(e.oldId) ?? 0));
          since.delete(e.oldId);
        }
        since.set(e.newId, d);
      }
      if (e.kind === 'abandon') {
        abandons++;
        tenures.push(d - (since.get(e.maleId) ?? 0));
        since.delete(e.maleId);
      }
    }
  }
  holderSlots += w.slotHolders.length;
  for (const id of initial) if (w.slotHolders.includes(id)) fullSeason++;
  w.endBreedingSeason();
  w.forage();
}
const mean = tenures.reduce((a, b) => a + b, 0) / Math.max(1, tenures.length);
console.log(`奪取 ${(takeovers / years).toFixed(1)}回/季  消耗で退場 ${(abandons / years).toFixed(1)}回/季  途中で終わった在任の平均 ${mean.toFixed(1)}日`);
console.log(`期首の主が期末まで守り切った割合 ${((fullSeason / holderSlots) * 100).toFixed(0)}%`);
