// 自動進行で群れの推移を眺めるバランス調整用スクリプト
// 使い方: npm run balance -- [seed] [years]
import { World } from '../src/sim/world';

const seed = Number(process.argv[2] ?? 1);
const years = Number(process.argv[3] ?? 150);
const w = World.create(seed, 0);
const t0 = Date.now();
const causes: Record<string, number> = {};
let holderMatings = 0;
let totalMatings = 0;
for (let y = 0; y < years; y++) {
  const { forage } = w.simulateYearAuto();
  for (const d of forage.deaths) causes[d.cause] = (causes[d.cause] ?? 0) + 1;
  const h = w.history[w.history.length - 1];
  if (y % 10 === 0 || y === years - 1) {
    const top = w.living().filter((i) => i.sex === 'M').sort((a, b) => b.lifetime.matings - a.lifetime.matings)[0];
    console.log(
      `y${String(h.year).padStart(3)} pop ${String(h.population).padStart(3)} M${String(h.adultMales).padStart(3)} F${String(h.adultFemales).padStart(3)} births ${String(h.births).padStart(3)}` +
        ` hoko ${h.hokoMean.toFixed(1)} testis ${h.testisMean.toFixed(0)} body ${h.bodyMean.toFixed(0)} pref ${h.prefMean.toFixed(2)}` +
        ` S ${h.freqS.toFixed(3)} F ${h.freqF.toFixed(3)} del ${h.delLoadMean.toFixed(2)}` +
        ` pat R${(h.paternityByTactic.R * 100).toFixed(0)} S${(h.paternityByTactic.S * 100).toFixed(0)} F${(h.paternityByTactic.F * 100).toFixed(0)}` +
        ` topMatings ${top?.lifetime.matings ?? 0}`,
    );
  }
}
// 直近の繁殖期の交尾の偏り
const season = w.living().filter((i) => i.sex === 'M' && w.age(i) >= 4).map((m) => m.season.matings).sort((a, b) => b - a);
const tot = season.reduce((a, b) => a + b, 0) || 1;
console.log('last season matings (top 12):', season.slice(0, 12).join(' '), ' top5 share', ((season.slice(0, 5).reduce((a, b) => a + b, 0) / tot) * 100).toFixed(0) + '%', ' zero', season.filter((x) => x === 0).length, '/', season.length);
// 交尾の偏り：今年の交尾数の分布
const males = w.living().filter((i) => i.sex === 'M' && w.age(i) >= 5);
const ms = males.map((m) => m.lifetime.matings).sort((a, b) => b - a);
console.log('lifetime matings of living adult males (top 15):', ms.slice(0, 15).join(' '), ' zero:', ms.filter((x) => x === 0).length, '/', ms.length);
console.log('death causes:', causes);
console.log('slots:', w.slotHolders.length, 'elapsed ms', Date.now() - t0);
void holderMatings; void totalMatings;
