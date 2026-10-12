import { LOCI, allelesAt, coatAlleleName, tacticAlleleName } from '../sim/genetics';
import {
  bodyMass,
  coatLabel,
  hokoDisplay,
  hokoFirmness,
  spermCapacity,
  tacticLabel,
  testisMass,
  type Individual,
} from '../sim/individual';
import { bloodEstimate, hokoPotential, potentialStars, starText } from '../sim/lineage';
import { BREED_DAYS, GROOM_LABEL, MILESTONES, causeLabel, type LogKind, type World } from '../sim/world';
import { P } from '../render/palette';
import { lineChart } from './chart';
import { bar, btn, clear, h } from './dom';
import { portrait } from './portrait';

export type Tab = 'self' | 'selected' | 'herd' | 'dynasty';

export interface GameView {
  world: World;
  tab: Tab;
  selectedId: number | null;
  logFilter: LogKind | 'all';
  select(id: number | null): void;
  setTab(t: Tab): void;
  setLogFilter(f: LogKind | 'all'): void;
  stanceGuard(): void;
  stanceAuto(): void;
  stanceRest(): void;
  stanceRoam(): void;
  openChallenge(): void;
  openSlotPick(kind: 'follow' | 'infiltrate'): void;
  openAttend(femaleId?: number): void;
  fastForward(): void;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

function sexLabel(ind: Individual): string {
  return ind.sex === 'M' ? 'オス' : 'メス';
}

function ordinal(n: number): string {
  const d = ['', '初', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  return n <= 10 ? `${d[n]}代目` : `${n}代目`;
}

export function nameLink(g: GameView, ind: Individual | undefined): HTMLElement | string {
  if (!ind) return '―';
  return h('span', { class: 'who', onclick: () => g.select(ind.id) }, ind.name);
}

// ───────────────────────── 自分 ─────────────────────────

function playerCard(g: GameView): HTMLElement {
  const w = g.world;
  const p = w.player;
  if (!p) return h('div', { class: 'win' }, '―');
  const y = w.year;
  const age = w.age(p);
  const slot = w.slotOf(p);
  const rank = w.rankOf(p);
  const harem = slot !== null ? w.slotFemales(slot).length : 0;
  const cap = slot !== null ? w.guardCap(p) : 0;
  const cardHead = h(
    'div',
    { class: 'card-head' },
    portrait(p, w, { rear: slot !== null }),
    h(
      'div',
      null,
      h('div', { class: 'name' }, p.name),
      h('div', { class: 'sub' }, `${ordinal(w.generation)}・${age}歳`),
      h('div', null, h('span', { class: `tag ${p.base.tactic}` }, tacticLabel(p.base.tactic)), slot !== null ? h('span', { class: 'tag gold' }, '主') : null),
    ),
  );
  const hoko = hokoDisplay(p, y);
  const sperm = p.sperm;
  const spermCap = spermCapacity(p, y);
  const stats = h(
    'div',
    null,
    stat('脂肪', bar(p.condition, 'hp'), pct(p.condition)),
    h('div', { class: 'sub fat-note' }, '脂肪が多いほど、来季のホコが張り、取っ組み合いに強く、見張れるメスも増える。'),
    stat('ケガ', bar(p.injury, 'hurt'), p.injury < 0.05 ? 'なし' : pct(p.injury)),
    stat('ホコ', bar(hoko / 70, 'hoko'), `${hoko.toFixed(1)}cm`),
    stat('　素質', h('span', { class: 'sub' }, `${age < 7 ? '7歳まで育つ・' : ''}張り${Math.round(hokoFirmness(p) * 100)}%`), `${p.base.hoko.toFixed(1)}cm`),
    stat('貯精', bar(spermCap ? sperm / spermCap : 0, 'sperm'), `${Math.round(sperm)}億`),
    stat('序列', h('span', { class: 'sub' }, rank ? `戦績順・${rank.of}頭中` : '―'), rank ? `${rank.rank}位` : '―'),
    stat('ハーレム', bar(cap ? Math.min(1, harem / cap) : 0, 'love'), slot !== null ? `${harem}頭/見張${cap}` : 'なし'),
    stat('今季交尾', h('span'), `${p.season.matings}回`),
    stat('子', h('span'), `${p.childIds.length}頭`),
  );
  const thought = p.thought ? h('div', { class: 'thought' }, `「${p.thought.text}」`) : null;
  return h('div', { class: 'win gold' }, cardHead, stats, thought, actions(g, p));
}

function stat(k: string, mid: HTMLElement, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('span', { class: 'k' }, k), mid, h('span', { class: 'v' }, v));
}

function actions(g: GameView, p: Individual): HTMLElement {
  const w = g.world;
  const st = w.playerStance.kind;
  const age = w.age(p);
  const box = h('div', { class: 'actions' });
  if (w.phase !== 'breeding') return box;
  if (age < 4 || !p.onBeach) {
    box.append(
      h('div', { class: 'hint' }, p.onBeach ? `まだ若い（${age}歳）。大人たちのやり方を見て学ぼう。` : '浜を離れて海で体を休めている。'),
      btn('4歳まで早送り', () => g.fastForward(), 'primary'),
    );
    return box;
  }
  const on = (k: string) => (st === k ? 'on' : '');
  box.append(h('div', { class: 'plan' }, h('span', { class: 'k' }, '今日の予定'), h('span', null, planText(w))));
  if (p.base.tactic === 'R') {
    const holder = w.slotOf(p) !== null;
    const harem = holder ? w.slotFemales(w.slotOf(p)!).length : 0;
    const hintText = holder
      ? harem === 0
        ? 'まだメスがいない。メスは浜を見て回り、魅力のある主のもとへ自然に集まってくる。脂肪とホコの張りを保ち、浜を騒がしくしないで待とう。'
        : '主として浜を守っている。挑戦者を退け、メスを見張れ。「おまかせ」なら様子を見てメスに構ってくれる。'
      : age < 5
        ? 'まだ挑むには若い。うろついて、隙をうかがおう。'
        : '主の座を狙うか、見張りの外のメスをうかがうか。';
    box.append(h('div', { class: 'hint' }, hintText));
    if (holder) {
      box.append(
        btn('守る', () => g.stanceGuard(), on('guard')),
        btn('おまかせ', () => g.stanceAuto(), on('auto')),
        btn('メスに構う…', () => g.openAttend(), ['court', 'groom', 'tend', 'escort', 'soothe'].includes(st) ? 'on' : ''),
      );
    }
    if (age >= 5) box.append(btn('挑む…', () => g.openChallenge(), on('challenge')));
    if (!holder) box.append(btn('うろつく', () => g.stanceRoam(), on('roam')));
    box.append(btn('海で食べる', () => g.stanceRest(), on('rest')));
  } else if (p.base.tactic === 'S') {
    const s = w.playerStance.kind === 'follow' ? w.playerStance.slot : null;
    const holder = s !== null ? w.get(w.slotHolders[s]) : undefined;
    box.append(
      h('div', { class: 'hint' }, holder ? `${holder.name}の浜に付き従っている。主が争う隙を待て。` : '付き従う主を選ぼう。'),
      btn('付き従う…', () => g.openSlotPick('follow'), on('follow')),
      btn('海で食べる', () => g.stanceRest(), on('rest')),
    );
  } else {
    const s = w.playerStance.kind === 'infiltrate' ? w.playerStance.slot : null;
    const holder = s !== null ? w.get(w.slotHolders[s]) : undefined;
    box.append(
      h('div', { class: 'hint' }, holder ? `メスのふりをして${holder.name}の浜に紛れている。` : '紛れ込む浜を選ぼう。'),
      btn('紛れ込む…', () => g.openSlotPick('infiltrate'), on('infiltrate')),
      btn('海で食べる', () => g.stanceRest(), on('rest')),
    );
  }
  return box;
}

/** いま選んでいる方針を、次に日を進めたときに起きることとして書く */
function planText(w: World): string {
  const s = w.playerStance;
  const holderName = (slot: number) => w.get(w.slotHolders[slot])?.name ?? '―';
  switch (s.kind) {
    case 'challenge': {
      const t = w.get(s.targetId);
      return t ? `${t.name}に挑む${w.slotOf(t) !== null ? '（勝てば浜とハーレムを奪う）' : ''}。今日限り` : '挑む相手がいない';
    }
    case 'guard': return '浜を守る（見張れるメスが増え、取っ組み合いで粘る）。変えるまで毎日続く';
    case 'auto': return 'おまかせ：毎朝ハーレムの様子を見て、守る・なだめる・構うから選ぶ。変えるまで毎日続く';
    case 'roam': return 'うろついて、見張りの外のメスをうかがう。変えるまで毎日続く';
    case 'rest': return w.player && w.slotOf(w.player) !== null
      ? '海で食べる（脂肪が戻る。ただし見張りはほとんどできない）。変えるまで毎日続く'
      : '海で食べる（脂肪が戻る。交尾はしない）。変えるまで毎日続く';
    case 'follow': return `${holderName(s.slot)}の浜に付き従い、隙を待つ`;
    case 'infiltrate': return `メスのふりをして${holderName(s.slot)}の浜に紛れ込む`;
    case 'court': {
      const f = w.get(s.femaleId);
      return f ? `${f.name}に迫ってつがう（${w.femaleStatus(f).label}）。今日限り` : 'つがう相手がいない';
    }
    case 'groom': {
      const f = w.get(s.femaleId);
      return f ? `${f.name}に${GROOM_LABEL[s.type]}をさせる。今日限り` : '世話をさせる相手がいない';
    }
    case 'tend': {
      const f = w.get(s.femaleId);
      return f ? `${f.name}を毛づくろいしてあげる。今日限り` : '構う相手がいない';
    }
    case 'escort': {
      const f = w.get(s.femaleId);
      return f ? `一日じゅう${f.name}に寄り添って守る。今日限り` : '構う相手がいない';
    }
    case 'soothe':
      return '低い声で鳴いて、ハーレム全体をなだめる。今日限り';
  }
}

// ───────────────────────── 個体の詳細 ─────────────────────────

export function inspector(g: GameView, ind: Individual): HTMLElement {
  const w = g.world;
  const y = w.year;
  const age = w.age(ind);
  const mother = w.get(ind.motherId);
  const father = w.get(ind.fatherId);
  const slot = ind.sex === 'M' ? w.slotOf(ind) : null;
  const status = !ind.alive
    ? `${w.displayYear(ind.deathYear!)}年目に${causeLabel(ind.deathCause!)}で死亡`
    : ind.onBeach
      ? slot !== null
        ? `ハーレムの主（${w.slotFemales(slot).length}頭）`
        : ind.sex === 'F' && ind.slot !== null
          ? `${w.get(w.slotHolders[ind.slot])?.name ?? '―'}のハーレム`
          : '浜にいる'
      : '海にいる';
  const tags = h(
    'div',
    null,
    h('span', { class: 'tag' }, sexLabel(ind)),
    ind.sex === 'M' ? h('span', { class: `tag ${ind.base.tactic}` }, tacticLabel(ind.base.tactic)) : null,
    ind.id === w.playerId ? h('span', { class: 'tag gold' }, 'あなた') : ind.dynasty > 0 ? h('span', { class: 'tag', style: `background:${P.pink0}` }, `一族 ${pct(ind.dynasty)}`) : null,
    ind.immigrant ? h('span', { class: 'tag' }, 'よそ者') : null,
  );
  const head = h(
    'div',
    { class: 'card-head' },
    portrait(ind, w),
    h('div', null, h('div', { class: 'name' }, ind.name), h('div', { class: 'sub' }, `${age}歳・${status}`), tags),
  );
  const rows: HTMLElement[] = [];
  rows.push(stat('母', h('span'), ''), stat('父', h('span'), ''));
  rows[0].querySelector('.v')!.replaceWith(h('span', { class: 'v' }, nameLink(g, mother)));
  rows[1].querySelector('.v')!.replaceWith(h('span', { class: 'v' }, nameLink(g, father)));
  rows.push(stat('子', h('span'), `${ind.childIds.length}頭（生存${ind.childIds.filter((c) => w.get(c)?.alive).length}）`));
  if (ind.alive) {
    rows.push(stat('脂肪', bar(ind.condition, 'hp'), pct(ind.condition)));
    if (ind.injury > 0.05) rows.push(stat('ケガ', bar(ind.injury, 'hurt'), pct(ind.injury)));
  }
  rows.push(stat('体重', h('span'), `${Math.round(bodyMass(ind, y))}kg`));
  if (ind.sex === 'M') {
    rows.push(stat('ホコ', bar(hokoDisplay(ind, y) / 70, 'hoko'), `${hokoDisplay(ind, y).toFixed(1)}cm`));
    rows.push(stat('　素質', h('span', { class: 'stars' }, starText(potentialStars(ind.base.hoko, w.herdHokoMean()))), `${ind.base.hoko.toFixed(1)}cm`));
    rows.push(stat('精巣', h('span'), `${Math.round(testisMass(ind, y))}g`));
    rows.push(stat('生涯交尾', h('span'), `${ind.lifetime.matings}回`));
  } else {
    rows.push(stat('好み', bar(ind.base.pref, 'hoko'), ind.base.pref > 0.6 ? 'ホコ重視' : ind.base.pref < 0.4 ? '穏やか好き' : 'ふつう'));
    rows.push(bloodRow(w, ind));
    if (ind.alive && ind.slot !== null) rows.push(stat('愛着', bar(ind.loyalty, 'love'), pct(ind.loyalty)));
  }
  rows.push(stat('気性', h('span', { class: 'sub' }, `攻${Math.round(ind.base.aggression * 9)} 胆${Math.round(ind.base.boldness * 9)}`), temperLabel(ind)));
  const thought = ind.thought && ind.alive ? h('div', { class: 'thought' }, `「${ind.thought.text}」`) : null;
  // 自分のハーレムのメスなら、ここから直接構える
  const attend =
    w.phase === 'breeding' && ind.alive && w.isPlayerHaremFemale(ind)
      ? h('div', { class: 'actions' }, btn('この子に構う…', () => g.openAttend(ind.id), 'primary'))
      : null;
  return h('div', null, head, thought, attend, h('div', null, ...rows), genomeView(ind));
}

/** メスの血筋の見立て（父と兄弟のホコから、息子に伝わる素質を推す） */
export function bloodRow(w: World, f: Individual): HTMLElement {
  const est = bloodEstimate(f, (id) => w.get(id), w.inds.values());
  if (!est) return stat('血筋', h('span', { class: 'sub' }, '父も兄弟も知れない'), '不明');
  return h(
    'div',
    null,
    stat('血筋', h('span', { class: 'stars' }, starText(potentialStars(est.value, w.herdHokoMean()))), `約${est.value.toFixed(0)}cm`),
    h('div', { class: 'sub', style: 'text-align:right' }, `${est.clues.join('・')}のホコから見立てた`),
  );
}

function temperLabel(ind: Individual): string {
  const a = ind.base.aggression;
  const b = ind.base.boldness;
  if (a > 0.62 && b > 0.62) return '荒くれ';
  if (a > 0.62) return '短気';
  if (b > 0.62) return '豪胆';
  if (a < 0.38 && b < 0.38) return '臆病';
  if (a < 0.38) return '温厚';
  if (b < 0.38) return '慎重';
  return '並';
}

/** 遺伝子型の表示：量的座位は対立遺伝子ごとの効果を棒で、離散座位は記号で */
function genomeView(ind: Individual): HTMLElement {
  const g = ind.genome;
  const box = h('details', { class: 'genome' }, h('summary', null, '遺伝子型を見る'));
  const grid = h('div', { class: 'genes' });
  const scale: Record<string, number> = { hoko: 6, body: 0.12, testis: 100, pref: 0.25, aggression: 0.25, boldness: 0.25, hubris: 0.12 };
  const label: Record<string, string> = {
    HOKO1: 'ホコ1', HOKO2: 'ホコ2', HOKO3: 'ホコ3', HOKOY: 'ホコY',
    TES1: '精巣1', TES2: '精巣2', TESX: '精巣X',
    BODY1: '体格1', BODY2: '体格2', PREF1: '好み1', PREF2: '好み2',
    AGG1: '攻撃1', AGG2: '攻撃X', BOLD1: '胆力1', BOLD2: '胆力2', HUBRIS: '慢心',
  };
  for (const l of LOCI) {
    if (l.kind !== 'quant') continue;
    const a = allelesAt(g, l.id);
    if (a.length === 0) continue;
    const cells = a.map((v) => {
      const frac = Math.min(1, Math.abs(v) / (scale[l.trait!] ?? 1)) * 50;
      return h('div', { class: 'allele' }, h('i', { class: v >= 0 ? 'pos' : 'neg', style: `width:${frac.toFixed(1)}%` }));
    });
    if (cells.length === 1) cells.push(h('div', { class: 'sub', style: 'line-height:12px' }, l.chrom === 'Y' ? '（Y）' : '（ヘミ）'));
    grid.append(h('span', { class: 'k' }, label[l.id] ?? l.id), ...cells);
  }
  const tac = allelesAt(g, 'TACTIC');
  const coat = allelesAt(g, 'COAT');
  grid.append(
    h('span', { class: 'k' }, '戦略'),
    h('span', { class: 'allele-sym' }, tac.map(tacticAlleleName).join(' / ')),
    h('span', { class: 'sub' }, ind.sex === 'M' ? tacticLabel(ind.base.tactic) : '（メスは発現せず）'),
    h('span', { class: 'k' }, '毛色'),
    h('span', { class: 'allele-sym' }, coat.map(coatAlleleName).join(' / ')),
    h('span', { class: 'sub' }, coatLabel(ind.base.coat)),
  );
  box.append(grid);
  // 有害劣性突然変異
  const del = h('div', { class: 'del-row' });
  let het = 0;
  let hom = 0;
  for (const l of LOCI) {
    if (l.kind !== 'deleterious') continue;
    const a = allelesAt(g, l.id);
    const n = a[0] + (a[1] ?? 0);
    const isHom = a.length === 1 ? n === 1 : n === 2;
    if (isHom) hom++;
    else if (n > 0) het++;
    del.append(h('i', { class: isHom ? 'hom' : n > 0 ? 'het' : '' }));
  }
  box.append(
    h('div', { class: 'sub', style: 'margin-top:4px' }, `有害劣性：保因${het}・発症${hom}　活力 ${pct(ind.base.vigor)}`),
    del,
  );
  return box;
}

// ───────────────────────── 群れ ─────────────────────────

function herdView(g: GameView): HTMLElement {
  const w = g.world;
  const hist = w.history.slice(-60);
  const box = h('div', null);
  if (hist.length < 2) {
    box.append(h('div', { class: 'sub' }, '記録がたまるまで、数年かかる。'));
  }
  const last = hist[hist.length - 1];
  if (last) {
    box.append(
      h(
        'table',
        { class: 'mini' },
        h('tr', null, h('td', null, '個体数'), h('td', { class: 'r' }, last.population), h('td', null, '今年の出生'), h('td', { class: 'r' }, last.births)),
        h('tr', null, h('td', null, '成熟オス'), h('td', { class: 'r' }, last.adultMales), h('td', null, '成熟メス'), h('td', { class: 'r' }, last.adultFemales)),
      ),
    );
  }
  const legend = (items: [string, string][]) => h('div', { class: 'legend sub' }, ...items.map(([c, t]) => h('span', null, h('i', { style: `background:${c}` }), t)));
  box.append(h('h3', null, 'ホコの平均（遺伝的な基本長）'));
  box.append(lineChart([{ values: hist.map((x) => x.hokoMean), color: P.gold0 }]));
  if (last) box.append(h('div', { class: 'sub' }, `いま ${last.hokoMean.toFixed(1)}cm`));
  box.append(h('h3', null, '精巣と体格'));
  box.append(
    lineChart([
      { values: hist.map((x) => x.testisMean / 400), color: P.gray0 },
      { values: hist.map((x) => x.bodyMean / 1500), color: P.sand2 },
    ]),
  );
  box.append(legend([[P.gray0, '精巣'], [P.sand2, '体重']]));
  box.append(h('h3', null, 'メスの好み（ホコ重視度）'));
  box.append(lineChart([{ values: hist.map((x) => x.prefMean), color: P.pink1 }], { min: 0, max: 1 }));
  box.append(h('h3', null, '戦略の遺伝子頻度'));
  box.append(
    lineChart(
      [
        { values: hist.map((x) => x.freqS), color: P.gray0 },
        { values: hist.map((x) => x.freqF), color: P.pink0 },
      ],
      { min: 0 },
    ),
  );
  box.append(legend([[P.gray0, '衛星S'], [P.pink0, '忍びF']]));
  if (last) {
    const pt = last.paternityByTactic;
    box.append(h('div', { class: 'sub' }, `今年の子の父：主型${pct(pt.R)}・衛星型${pct(pt.S)}・忍び型${pct(pt.F)}`));
  }
  box.append(h('h3', null, '有害突然変異の平均保有数'));
  box.append(lineChart([{ values: hist.map((x) => x.delLoadMean), color: P.red1 }], { min: 0 }));
  return box;
}

// ───────────────────────── 血統 ─────────────────────────

function dynastyView(g: GameView): HTMLElement {
  const w = g.world;
  const founder = w.get(w.founderId);
  const hist = w.history.filter((x) => x.year >= w.startYear).slice(-60);
  const members = w
    .living()
    .filter((i) => i.dynasty > 0)
    .sort((a, b) => b.dynasty - a.dynasty || w.age(b) - w.age(a));
  const share = members.reduce((s, i) => s + i.dynasty, 0) / Math.max(1, w.living().length);
  const next = MILESTONES.find((m) => !w.milestonesReached.includes(m));
  const prev = [...MILESTONES].reverse().find((m) => w.milestonesReached.includes(m)) ?? 0;
  const legend = (items: [string, string][]) => h('div', { class: 'legend sub' }, ...items.map(([c, t]) => h('span', null, h('i', { style: `background:${c}` }), t)));
  const box = h(
    'div',
    null,
    h(
      'table',
      { class: 'mini' },
      h('tr', null, h('td', null, '初代'), h('td', { class: 'r' }, founder ? nameLink(g, founder) : '―'), h('td', null, '当主'), h('td', { class: 'r' }, ordinal(w.generation))),
      h('tr', null, h('td', null, '血統占有率'), h('td', { class: 'r' }, `${(share * 100).toFixed(1)}%`), h('td', null, '一族'), h('td', { class: 'r' }, `${members.length}頭`)),
    ),
    next
      ? h(
          'div',
          { class: 'stat' },
          h('span', { class: 'k' }, `次の節目`),
          bar((share - prev) / (next - prev), 'love'),
          h('span', { class: 'v' }, `${Math.round(next * 100)}%`),
        )
      : h('div', { class: 'name' }, 'すべての節目を超えた。この浜はあなたの一族のものだ。'),
    h('h3', null, '血統占有率の推移'),
    lineChart([{ values: hist.map((x) => x.dynastyShare), color: P.pink1 }], { min: 0 }),
    h('div', { class: 'sub' }, '群れ全体のゲノムのうち、初代から受け継がれた割合の期待値。節目は 1・2・5・10・20・30・50%。'),
    h('h3', null, 'ホコの遺伝的な平均'),
    lineChart([
      { values: hist.map((x) => x.herdGeneticHoko), color: P.gray1 },
      { values: hist.map((x) => x.dynastyGeneticHoko), color: P.gold0 },
    ]),
    legend([[P.gold0, '一族'], [P.gray1, '群れ']]),
    h('div', { class: 'sub' }, 'オスもメスも、主型のオスとして育ったときの長さに直した値。一族が群れの上を行けば、選んだ血が効いている。'),
  );
  if (w.bestHoko) {
    const b = w.bestHoko;
    box.append(h('div', { class: 'sub', style: 'margin-top:4px' }, '一族最高の素質：', nameLink(g, w.get(b.id)), ` ${b.value.toFixed(1)}cm（${w.displayYear(b.year)}年目）`));
  }
  // 歴代当主
  box.append(h('h3', null, '歴代当主'));
  const heads = h('div', { class: 'heads' });
  w.heads.forEach((hd, i) => {
    const ind = w.get(hd.id);
    const prevHd = w.heads[i - 1];
    const diff = prevHd ? hd.potential - prevHd.potential : 0;
    const vsHerd = hd.potential - hd.herdMean;
    const span = `${w.displayYear(hd.fromYear)}〜${hd.toYear !== null ? `${w.displayYear(hd.toYear)}年目` : ''}`;
    heads.append(
      h(
        'button',
        { class: `btn small item head ${hd.id === w.playerId ? 'on' : ''}`, onclick: () => g.select(hd.id) },
        h('span', null, h('span', { class: 'sub' }, `${ordinal(hd.generation)} `), hd.name, h('span', { class: 'sub' }, ` ${span}`)),
        h('span', { class: 'sub' }, `ハーレム最大${hd.peakHarem}・子${ind?.childIds.length ?? 0}${hd.cause ? `・${causeLabel(hd.cause)}` : ''}`),
        h('span', null, `${hd.potential.toFixed(1)}cm`, h('span', { class: diff > 0 ? 'up' : diff < 0 ? 'down' : 'sub' }, i > 0 ? ` ${diff >= 0 ? '+' : ''}${diff.toFixed(1)}` : ''), h('span', { class: 'sub' }, `（群れ比${vsHerd >= 0 ? '+' : ''}${vsHerd.toFixed(1)}）`)),
      ),
    );
  });
  box.append(heads, h('div', { class: 'sub' }, '数字はホコの素質。＋−は先代との差、群れ比は当主になったときの群れの平均との差。'));
  box.append(h('h3', null, '生きている一族'));
  const list = h('div', { class: 'list' });
  const mean = w.herdHokoMean();
  for (const m of members.slice(0, 40)) {
    list.append(
      h(
        'button',
        { class: 'btn small item', onclick: () => g.select(m.id) },
        h('span', null, m.id === w.playerId ? '★' : '', m.name, h('span', { class: 'sub' }, ` ${sexLabel(m)} ${w.age(m)}歳`)),
        h('span', { class: 'sub' }, starText(potentialStars(hokoPotential(m), mean))),
        h('span', null, pct(m.dynasty)),
      ),
    );
  }
  if (members.length === 0) list.append(h('div', { class: 'sub' }, 'まだ子はいない。'));
  box.append(list);
  return box;
}

// ───────────────────────── 組み立て ─────────────────────────

export function renderSide(g: GameView, root: HTMLElement): void {
  const scrollTop = root.querySelector('.scroll')?.scrollTop ?? 0;
  clear(root);
  root.append(playerCard(g));
  const tab = (t: Tab, label: string) => btn(label, () => g.setTab(t), `small ${g.tab === t ? 'on' : ''}`);
  root.append(h('div', { class: 'tabs' }, tab('selected', '個体'), tab('herd', '群れ'), tab('dynasty', '血統')));
  const body = h('div', { class: 'win scroll' });
  if (g.tab === 'herd') body.append(herdView(g));
  else if (g.tab === 'dynasty') body.append(dynastyView(g));
  else {
    const sel = g.world.get(g.selectedId);
    body.append(sel ? inspector(g, sel) : h('div', { class: 'sub' }, '浜の個体をクリックすると、ここに詳しく出る。'));
  }
  root.append(body);
  body.scrollTop = scrollTop;
}

export function renderLog(g: GameView, root: HTMLElement): void {
  const entries = root.querySelector<HTMLElement>('.entries');
  const atBottom = !entries || entries.scrollHeight - entries.scrollTop - entries.clientHeight < 24;
  clear(root);
  const f = (k: LogKind | 'all', label: string) => btn(label, () => g.setLogFilter(k), `small ${g.logFilter === k ? 'on' : ''}`);
  root.append(h('div', { class: 'filters' }, f('all', 'すべて'), f('player', '自分'), f('dynasty', '一族'), f('thought', 'つぶやき'), f('event', '浜')));
  const list = h('div', { class: 'entries' });
  const w = g.world;
  const items = w.log.filter((e) => g.logFilter === 'all' || e.kind === g.logFilter).slice(-150);
  for (const e of items) {
    const who = e.indId != null ? w.get(e.indId) : undefined;
    list.append(
      h(
        'div',
        { class: `entry k-${e.kind}`, onclick: who ? () => g.select(who.id) : undefined },
        h('span', { class: 'when' }, e.day >= BREED_DAYS ? `${w.displayYear(e.year)}年 冬` : `${w.displayYear(e.year)}年${e.day + 1}日`),
        h('span', null, e.text),
      ),
    );
  }
  root.append(list);
  if (atBottom) list.scrollTop = list.scrollHeight;
}
