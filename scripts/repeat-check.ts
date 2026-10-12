// 目に入るセリフ（ログのつぶやき）の繰り返しを数える
import { World } from '../src/sim/world';

let worst = 0;
let total = 0;
let distinct = 0;
const tops: string[] = [];
for (const seed of [1, 2, 3, 4]) {
  const w = World.create(seed, 0);
  w.choosePlayer(w.founderCandidates()[0].id, true);
  for (let y = 0; y < 6; y++) {
    const before = w.log.length;
    w.simulateYearAuto();
    const lines = w.log.slice(before).filter((l) => l.kind === 'thought').map((l) => l.text.replace(/^[^「]*「/, '「'));
    const c = new Map<string, number>();
    for (const t of lines) c.set(t, (c.get(t) ?? 0) + 1);
    const top = [...c.entries()].sort((a, b) => b[1] - a[1])[0];
    total += lines.length;
    distinct += c.size;
    if (top && top[1] > worst) worst = top[1];
    for (const [t, n] of c) if (n >= 5) tops.push(`${n}回 ${t}`);
  }
}
console.log(`つぶやき ${total} 行・異なる文 ${distinct}（${((distinct / total) * 100).toFixed(0)}%）・1年で同じ文の最多 ${worst} 回`);
console.log(tops.join('\n'));
