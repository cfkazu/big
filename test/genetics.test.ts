import { describe, expect, it } from 'vitest';
import {
  COAT_B,
  COAT_P,
  LOCUS_INDEX,
  TACTIC_F,
  TACTIC_R,
  TACTIC_S,
  allelesAt,
  coatOf,
  fertilize,
  makeGamete,
  randomGenome,
  recombine,
  tacticOf,
  type Genome,
} from '../src/sim/genetics';
import { Rng } from '../src/sim/rng';
import { World } from '../src/sim/world';
import { bloodEstimate } from '../src/sim/lineage';
import { builtinLines, customLines, makeThought, setCustomLines, SITUATIONS } from '../src/sim/thoughts';

function setAllele(g: Genome, locusId: string, which: 0 | 1, value: number) {
  const { chrom, idx } = LOCUS_INDEX[locusId];
  if (chrom === 'A1' || chrom === 'A2' || chrom === 'A3') g.auto[chrom][which][idx] = value;
  else if (chrom === 'X') (which === 0 ? g.sex1 : g.sex2)[idx] = value;
  else g.sex2[idx] = value;
}

describe('メンデル遺伝', () => {
  it('ヘテロ同士の交配で毛色の淡（劣性ホモ）がおよそ 1/4 出る', () => {
    const rng = new Rng(42);
    const mom = randomGenome('F', rng);
    const dad = randomGenome('M', rng);
    for (const g of [mom, dad]) {
      setAllele(g, 'COAT', 0, COAT_B);
      setAllele(g, 'COAT', 1, COAT_P);
    }
    let pale = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) {
      const kid = fertilize(makeGamete(mom, rng), makeGamete(dad, rng));
      if (coatOf(kid) === 'pale') pale++;
    }
    expect(pale / n).toBeGreaterThan(0.22);
    expect(pale / n).toBeLessThan(0.28);
  });

  it('性比はおよそ 1:1', () => {
    const rng = new Rng(7);
    const mom = randomGenome('F', rng);
    const dad = randomGenome('M', rng);
    let males = 0;
    for (let i = 0; i < 4000; i++) if (fertilize(makeGamete(mom, rng), makeGamete(dad, rng)).sex === 'M') males++;
    expect(males / 4000).toBeGreaterThan(0.47);
    expect(males / 4000).toBeLessThan(0.53);
  });

  it('Y 連鎖のホコ座位は父から息子にだけ伝わる', () => {
    const rng = new Rng(3);
    const mom = randomGenome('F', rng);
    const dad = randomGenome('M', rng);
    setAllele(dad, 'HOKOY', 1, 99);
    for (let i = 0; i < 200; i++) {
      const kid = fertilize(makeGamete(mom, rng), makeGamete(dad, rng));
      const y = allelesAt(kid, 'HOKOY');
      if (kid.sex === 'M') expect(Math.abs(y[0] - 99)).toBeLessThan(10); // 突然変異の幅だけずれうる
      else expect(y).toEqual([]);
    }
  });

  it('戦略スーパージーン：S/F は優性で、2 本そろうと致死', () => {
    const rng = new Rng(5);
    const g = randomGenome('M', rng);
    const cases: [number, number, string | null][] = [
      [TACTIC_R, TACTIC_R, 'R'],
      [TACTIC_R, TACTIC_S, 'S'],
      [TACTIC_F, TACTIC_R, 'F'],
      [TACTIC_S, TACTIC_S, null],
      [TACTIC_S, TACTIC_F, null],
      [TACTIC_F, TACTIC_F, null],
    ];
    for (const [a, b, want] of cases) {
      setAllele(g, 'TACTIC', 0, a);
      setAllele(g, 'TACTIC', 1, b);
      expect(tacticOf(g)).toBe(want);
    }
  });
});

describe('組換え', () => {
  it('組換え率は Haldane の写像関数 r = (1 - e^{-2d}) / 2 に従う', () => {
    // A1 上の HOKO1(12cM) と COAT(58cM)：d = 0.46 M → r ≈ 0.301
    const rng = new Rng(11);
    const i1 = LOCUS_INDEX.HOKO1.idx;
    const i2 = LOCUS_INDEX.COAT.idx;
    const len = 30;
    const h1 = new Array(len).fill(0);
    const h2 = new Array(len).fill(1);
    let rec = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const out = recombine(h1, h2, 'A1', rng);
      if (out[i1] !== out[i2]) rec++;
    }
    const expected = (1 - Math.exp(-2 * 0.46)) / 2;
    expect(Math.abs(rec / n - expected)).toBeLessThan(0.015);
  });
});

describe('群れのシミュレーション', () => {
  it('60 年回しても絶滅も爆発もしない', () => {
    const w = World.create(123, 0);
    for (let y = 0; y < 60; y++) w.simulateYearAuto();
    const pop = w.living().length;
    expect(pop).toBeGreaterThan(100);
    expect(pop).toBeLessThan(350);
    const h = w.history[w.history.length - 1];
    expect(h.births).toBeGreaterThan(10);
  });

  it('子の父は実際に交尾したオスで、創始血統の割合は両親の平均', () => {
    const w = World.create(9, 20);
    const founder = w.founderCandidates()[0];
    w.choosePlayer(founder.id, true);
    for (let y = 0; y < 8; y++) w.simulateYearAuto();
    for (const ind of w.inds.values()) {
      if (ind.motherId == null || ind.fatherId == null || ind.id === founder.id) continue;
      const m = w.get(ind.motherId)!;
      const f = w.get(ind.fatherId)!;
      expect(ind.dynasty).toBeCloseTo((m.dynasty + f.dynasty) / 2, 10);
      expect(f.sex).toBe('M');
      expect(m.sex).toBe('F');
    }
  });
});

describe('主としての行動', () => {
  function setupHolder() {
    const w = World.create(21, 20);
    const founder = w.founderCandidates()[0];
    w.choosePlayer(founder.id, true);
    w.startBreedingSeason();
    const p = w.player!;
    // プレイヤーを主にする
    const old = w.get(w.slotHolders[0]);
    if (old) old.slot = null;
    w.slotHolders[0] = p.id;
    p.slot = 0;
    p.sperm = 200;
    const f = w.living().find((i) => i.sex === 'F' && w.age(i) >= 4)!;
    f.slot = 0;
    f.onBeach = true;
    (w as unknown as { invalidateSlots(): void }).invalidateSlots();
    // ほかのオスは負けた直後ということにして、今日は挑んでこないようにする
    for (const m of w.living()) if (m.sex === 'M' && m.id !== p.id) m.lastLossDay = w.day;
    return { w, p, f };
  }

  function runDay(w: World) {
    const g = w.runDay();
    let r = g.next();
    while (!r.done) r = g.next('accept');
  }

  it('発情中のメスに迫ればつがえる', () => {
    const { w, p, f } = setupHolder();
    f.estrusStart = w.day;
    f.loyalty = 1;
    w.setPlayerStance({ kind: 'court', femaleId: f.id });
    const before = p.season.matings;
    runDay(w);
    expect(f.spermStore.some((d) => d.maleId === p.id)).toBe(true);
    expect(p.season.matings).toBeGreaterThan(before);
    // 翌日は守りに戻る
    expect(w.playerStance.kind === 'court').toBe(false);
  });

  it('発情していないメスには突っぱねられる', () => {
    const { w, p, f } = setupHolder();
    f.estrusStart = w.day + 10;
    f.loyalty = 0.5;
    w.setPlayerStance({ kind: 'court', femaleId: f.id });
    runDay(w);
    expect(f.spermStore.some((d) => d.maleId === p.id)).toBe(false);
    expect(w.log.some((l) => l.text.includes('突っぱねられた'))).toBe(true);
  });

  it('慕っているメスはホコの手入れをしてくれる', () => {
    const { w, p, f } = setupHolder();
    f.loyalty = 1;
    p.shine = 0;
    w.setPlayerStance({ kind: 'groom', femaleId: f.id, type: 'hoko' });
    runDay(w);
    expect(p.shine).toBeGreaterThan(0.03);
  });

  it('毛づくろいしてあげると機嫌が大きく良くなる', () => {
    const { w, f } = setupHolder();
    f.loyalty = 0.1;
    w.setPlayerStance({ kind: 'tend', femaleId: f.id });
    runDay(w);
    expect(f.loyalty).toBeGreaterThan(0.24);
    expect(w.playerStance.kind).not.toBe('tend');
  });

  it('寄り添っているメスには、ほかのオスが手を出せない', () => {
    const { w, p, f } = setupHolder();
    f.estrusStart = w.day;
    w.setPlayerStance({ kind: 'escort', femaleId: f.id });
    runDay(w);
    expect(f.spermStore.every((d) => d.maleId === p.id)).toBe(true);
  });

  it('なだめると浜の騒がしさが収まる', () => {
    const { w, p } = setupHolder();
    const s = w.slotOf(p)!;
    w.slotHarass[s] = 3;
    w.setPlayerStance({ kind: 'soothe' });
    runDay(w);
    expect(w.slotHarass[s]).toBeLessThan(1);
  });

  it('おまかせは、騒がしい浜ならなだめる', () => {
    const { w, p } = setupHolder();
    const s = w.slotOf(p)!;
    w.slotHarass[s] = 3;
    w.setPlayerStance({ kind: 'auto' });
    runDay(w);
    expect(w.log.some((l) => l.text.includes('おまかせ：浜が騒がしい'))).toBe(true);
    expect(w.playerStance.kind).toBe('auto');
  });

  it('海で食べると体力が戻る', () => {
    const { w, p } = setupHolder();
    p.condition = 0.3;
    w.setPlayerStance({ kind: 'rest' });
    runDay(w);
    expect(p.condition).toBeGreaterThan(0.3);
  });
});

describe('世代の進歩', () => {
  it('当主の記録が残り、代替わりで閉じる', () => {
    const w = World.create(31, 20);
    const a = w.founderCandidates()[0];
    w.choosePlayer(a.id, true);
    expect(w.heads).toHaveLength(1);
    expect(w.heads[0].potential).toBeCloseTo(a.base.hoko);
    // 初代が死んだことにして、別のオスを跡継ぎにする
    a.alive = false;
    a.deathYear = w.year;
    a.deathCause = 'orca';
    const b = w.living().find((i) => i.sex === 'M' && i.id !== a.id)!;
    w.choosePlayer(b.id, false);
    expect(w.heads).toHaveLength(2);
    expect(w.heads[0].cause).toBe('orca');
    expect(w.heads[1].generation).toBe(2);
  });

  it('血統占有率の節目は一度だけ記録される', () => {
    const w = World.create(32, 20);
    w.choosePlayer(w.founderCandidates()[0].id, true);
    for (const i of w.living().slice(0, 30)) i.dynasty = 0.5;
    const first = w.checkMilestones();
    expect(first.length).toBeGreaterThan(0);
    expect(w.checkMilestones()).toEqual([]);
  });

  it('メスの血筋は父と兄弟から見立てる', () => {
    const w = World.create(33, 30);
    const f = w.living().find((i) => i.sex === 'F' && i.fatherId != null && w.get(i.fatherId))!;
    const est = bloodEstimate(f, (id) => w.get(id), w.inds.values())!;
    expect(est.clues[0]).toContain('父');
    expect(est.value).toBeGreaterThan(15);
    expect(est.value).toBeLessThan(70);
  });
});

describe('初代の候補', () => {
  it('大物・並・小兵の順にホコの素質が下がり、小兵は精巣が大きめ', () => {
    for (const seed of [41, 42, 43]) {
      const w = World.create(seed, 40);
      const opts = w.founderOptions();
      const by = (k: string) => opts.find((o) => o.kind === k)!.ind;
      expect(by('big').base.hoko).toBeGreaterThan(by('mid').base.hoko);
      expect(by('mid').base.hoko).toBeGreaterThan(by('small').base.hoko);
      expect(new Set(opts.map((o) => o.ind.id)).size).toBe(opts.length);
    }
  });
});

describe('きのうのできごと', () => {
  it('手入れしてもらったことが要約に出る', () => {
    const w = World.create(21, 20);
    w.choosePlayer(w.founderCandidates()[0].id, true);
    w.startBreedingSeason();
    const p = w.player!;
    const old = w.get(w.slotHolders[0]);
    if (old) old.slot = null;
    w.slotHolders[0] = p.id;
    p.slot = 0;
    const f = w.living().find((i) => i.sex === 'F' && w.age(i) >= 4)!;
    f.slot = 0;
    f.onBeach = true;
    f.loyalty = 1;
    (w as unknown as { invalidateSlots(): void }).invalidateSlots();
    for (const m of w.living()) if (m.sex === 'M' && m.id !== p.id) m.lastLossDay = w.day;
    w.setPlayerStance({ kind: 'groom', femaleId: f.id, type: 'hoko' });
    const g = w.runDay();
    let r = g.next();
    while (!r.done) r = g.next('accept');
    expect(w.playerDigest().some((t) => t.includes(f.name) && t.includes('ホコをなめて綺麗に'))).toBe(true);
  });
});

describe('見立てとおまかせ', () => {
  it('浜の主に見せ合いで勝つと見立てるのは、ホコがはっきり大きいときだけ', () => {
    const w = World.create(51, 30);
    w.choosePlayer(w.founderCandidates()[0].id, true);
    w.startBreedingSeason();
    const p = w.player!;
    const holder = w.get(w.slotHolders.find((id) => id != null && id !== p.id)!)!;
    for (const t of w.challengeTargets()) {
      const v = w.challengeVerdict(w.get(t.id)!);
      const ratio = (w.hoko(p) * (1 + p.base.hubris)) / t.perceived;
      if (v.kind === 'displayWin') expect(ratio).toBeGreaterThan(t.isHolder ? 1.19 : 1.11);
    }
    expect(w.challengeVerdict(holder).odds).toBeGreaterThanOrEqual(0);
  });

  it('おまかせの主は、メスがいなければ海で食べ、翌日はおまかせに戻る', () => {
    const w = World.create(52, 20);
    w.choosePlayer(w.founderCandidates()[0].id, true);
    w.startBreedingSeason();
    const p = w.player!;
    const old = w.get(w.slotHolders[0]);
    if (old) old.slot = null;
    w.slotHolders[0] = p.id;
    p.slot = 0;
    for (const f of w.living()) if (f.slot === 0 && f.sex === 'F') f.slot = null;
    (w as unknown as { invalidateSlots(): void }).invalidateSlots();
    for (const m of w.living()) if (m.sex === 'M' && m.id !== p.id) m.lastLossDay = w.day;
    p.condition = 0.4;
    w.setPlayerStance({ kind: 'auto' });
    const g = w.runDay();
    let r = g.next();
    while (!r.done) r = g.next('accept');
    expect(p.condition).toBeGreaterThan(0.4);
    expect(w.playerStance.kind).toBe('auto');
  });
});

describe('不具合の修正', () => {
  it('海で食べても脂肪は100%を超えない', () => {
    const w = World.create(61, 20);
    w.choosePlayer(w.founderCandidates()[0].id, true);
    w.startBreedingSeason();
    const p = w.player!;
    p.condition = 0.995;
    w.setPlayerStance({ kind: 'rest' });
    for (let d = 0; d < 3; d++) {
      const g = w.runDay();
      let r = g.next();
      while (!r.done) r = g.next('retreat');
    }
    expect(p.condition).toBeLessThanOrEqual(1);
  });

  it('一族の子を身ごもったメスがいれば、血はまだ絶えていない', () => {
    const w = World.create(62, 20);
    w.choosePlayer(w.founderCandidates()[0].id, true);
    const p = w.player!;
    for (const i of w.living()) if (i.id !== p.id) i.dynasty = 0;
    const f = w.living().find((i) => i.sex === 'F' && w.age(i) >= 4)!;
    f.pregnancy = { fatherId: p.id, genome: f.genome, conceivedYear: w.year };
    p.alive = false;
    expect(w.heirCandidates()).toHaveLength(0);
    expect(w.lineSurvives()).toBe(true);
    expect(w.carriersOfLine().map((x) => x.id)).toContain(f.id);
  });
});

describe('発情の見込み', () => {
  it('ハーレムの発情中・これからの数と、浜全体の残りを数える', () => {
    const w = World.create(71, 20);
    w.startBreedingSeason();
    const s = w.slotHolders.findIndex((id) => id != null);
    const fs = w.slotFemales(s);
    const { now, later } = w.slotEstrus(s);
    const expectNow = fs.filter((f) => f.estrusStart >= 0 && w.day >= f.estrusStart && w.day < f.estrusStart + 3).length;
    const expectLater = fs.filter((f) => f.estrusStart > w.day).length;
    expect(now).toBe(expectNow);
    expect(later).toBe(expectLater);
    expect(w.estrusRemaining()).toBeGreaterThanOrEqual(now + later);
  });
});

describe('自分の欄のセリフ', () => {
  it('前の日にハーレムのメスがあなたに言ったことを優先する', () => {
    const w = World.create(81, 20);
    w.choosePlayer(w.founderCandidates()[0].id, true);
    w.startBreedingSeason();
    const p = w.player!;
    const old = w.get(w.slotHolders[0]);
    if (old) old.slot = null;
    w.slotHolders[0] = p.id;
    p.slot = 0;
    const [f1, f2] = w.living().filter((i) => i.sex === 'F' && w.age(i) >= 4).slice(0, 2);
    for (const f of [f1, f2]) {
      f.slot = 0;
      f.onBeach = true;
    }
    (w as unknown as { invalidateSlots(): void }).invalidateSlots();
    w.day = 5;
    p.thought = { text: '自分のつぶやき', year: w.year, day: 4, mood: 'neutral' };
    f1.thought = { text: 'お日さまが気持ちいい。', year: w.year, day: 4, mood: 'neutral', key: 'fIdle' };
    f2.thought = { text: 'ボスのホコ、今日も愛おしい。', year: w.year, day: 4, mood: 'love', key: 'fGroomHoko', aboutId: p.id };
    expect(w.featuredThought()!.speaker.id).toBe(f2.id);
    f1.thought = null;
    f2.thought = null;
    expect(w.featuredThought()!.speaker.id).toBe(p.id);
  });
});

describe('セリフ帳', () => {
  it('足したセリフは条件が合えば使われ、消せば使われない', () => {
    const w = World.create(5, 20);
    const f = w.living().find((i) => i.sex === 'F')!;
    const rng = new Rng(3);
    setCustomLines([{ id: 'x', key: 'fMated', tag: 'huge', text: '{other}の大物、忘れない。' }]);
    let hit = 0;
    for (let i = 0; i < 200; i++) {
      const t = makeThought(f, 'fMated', rng, { year: w.year, day: 1, other: 'ゴンタ', tags: ['huge'] });
      if (t.text === 'ゴンタの大物、忘れない。') hit++;
    }
    expect(hit).toBeGreaterThan(5);
    // 条件が合わないときは出ない
    for (let i = 0; i < 200; i++) expect(makeThought(f, 'fMated', rng, { year: w.year, day: 1, other: 'ゴンタ', tags: ['small'] }).text).not.toContain('大物、忘れない');
    // 条件なしのセリフはいつでも混ざる
    setCustomLines([{ id: 'y', key: 'fIdle', tag: '', text: '{I}は砂がすき。' }]);
    const texts = new Set(Array.from({ length: 300 }, () => makeThought(f, 'fIdle', rng, { year: w.year, day: 1 }).text));
    expect([...texts].some((t) => t.endsWith('は砂がすき。') && !t.includes('{I}'))).toBe(true);
    // おかしなものは入らない
    setCustomLines([{ id: 'z', key: 'nope' as never, tag: '', text: 'x' }, { id: 'w', key: 'fIdle', tag: 'bogus' as never, text: 'y' }]);
    expect(customLines()).toHaveLength(0);
  });

  it('どの場面にも5つ以上のセリフがある', () => {
    for (const key of Object.keys(SITUATIONS) as (keyof typeof SITUATIONS)[]) expect(builtinLines(key).length, key).toBeGreaterThanOrEqual(5);
  });
});

describe('何頭かでなめたとき', () => {
  it('同じ日に2頭以上がホコをなめると、ときどき専用のセリフが出る', () => {
    const w = World.create(11, 0);
    const said = new Map<string, string[]>();
    const ww = w as unknown as { think: (ind: { thought: { key?: string; text: string } | null }, key: string, ctx: unknown, prob?: number) => void };
    const orig = ww.think.bind(w);
    ww.think = (ind, key, ctx, prob) => {
      const before = ind.thought;
      orig(ind, key, ctx, prob);
      if (ind.thought !== before && (key === 'groomedHokoGroup' || key === 'fGroomHokoGroup')) said.set(key, [...(said.get(key) ?? []), ind.thought!.text]);
    };
    for (let y = 0; y < 3; y++) w.simulateYearAuto();
    expect(said.get('groomedHokoGroup')?.length ?? 0).toBeGreaterThan(0);
    expect(said.get('fGroomHokoGroup')?.length ?? 0).toBeGreaterThan(0);
    for (const t of [...said.values()].flat()) expect(t).not.toMatch(/[{}]/);
  });
});

describe('子どもたち', () => {
  it('メスの子は母のまねで世話を手伝い、オスの子や若いオスは主をうらやむ', () => {
    const w = World.create(12, 0);
    const said = new Map<string, { text: string; sex: string; age: number }[]>();
    const ww = w as unknown as { think: (ind: { sex: string; thought: { text: string } | null; ageAt(y: number): number }, key: string, ctx: unknown, prob?: number) => void };
    const orig = ww.think.bind(w);
    ww.think = (ind, key, ctx, prob) => {
      const before = ind.thought;
      orig(ind, key, ctx, prob);
      if (ind.thought !== before && (key === 'pupHelpGroom' || key === 'youngEnvy' || key === 'pupWaitMom')) said.set(key, [...(said.get(key) ?? []), { text: ind.thought!.text, sex: ind.sex, age: ind.ageAt(w.year) }]);
    };
    for (let y = 0; y < 3; y++) w.simulateYearAuto();
    const help = said.get('pupHelpGroom') ?? [];
    const envy = said.get('youngEnvy') ?? [];
    const wait = said.get('pupWaitMom') ?? [];
    expect(wait.length).toBeGreaterThan(0);
    expect(wait.every((x) => x.age === 0 && !/ホコ|なめ/.test(x.text))).toBe(true);
    // オスの子とメスの子で言うことが違う
    expect(wait.some((x) => x.sex === 'M' && x.text.includes('ぼく'))).toBe(true);
    expect(wait.some((x) => x.sex === 'F' && x.text.includes('わたし'))).toBe(true);
    expect(wait.some((x) => x.sex === 'M' && x.text.includes('わたし'))).toBe(false);
    expect(wait.some((x) => x.sex === 'F' && x.text.includes('ぼく'))).toBe(false);
    expect(help.length).toBeGreaterThan(0);
    expect(envy.length).toBeGreaterThan(0);
    expect(help.every((x) => x.sex === 'F' && x.age === 0)).toBe(true);
    expect(envy.every((x) => x.sex === 'M' && x.age < 5)).toBe(true);
    for (const x of [...help, ...envy]) expect(x.text).not.toMatch(/[{}]|誰か/);
  });
});

describe('浜の奪い合い', () => {
  it('主が別の浜を奪うと、もとの浜は空く（同じ主が二つの浜に入らない）', () => {
    const w = World.create(81, 20);
    w.choosePlayer(w.founderCandidates()[0].id, true);
    w.startBreedingSeason();
    const p = w.player!;
    for (let i = 0; i < w.slotHolders.length; i++) if (w.slotHolders[i] === p.id) w.slotHolders[i] = null;
    const other = w.get(w.slotHolders[1]!)!;
    const old0 = w.get(w.slotHolders[0]!);
    if (old0) old0.slot = null;
    w.slotHolders[0] = p.id;
    p.slot = 0;
    (w as unknown as { resolveWin(a: unknown, b: unknown, k: string, s: number): void }).resolveWin(p, other, 'display', 1);
    expect(w.slotHolders.filter((id) => id === p.id)).toHaveLength(1);
    expect(w.slotOf(p)).toBe(1);
    expect(w.slotHolders[0]).toBeNull();
  });

  it('何年回しても、ひとりの主が二つの浜に入らない', () => {
    const w = World.create(33, 0);
    const ww = w as unknown as { groomingPhase(): void };
    const orig = ww.groomingPhase.bind(w);
    let dup = 0;
    ww.groomingPhase = () => {
      const ids = w.slotHolders.filter((x) => x != null);
      if (new Set(ids).size !== ids.length) dup++;
      orig();
    };
    for (let y = 0; y < 15; y++) w.simulateYearAuto();
    expect(dup).toBe(0);
  });
});
