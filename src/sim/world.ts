import { allelesAt, fertilize, makeGamete, randomGenome, tacticOf, vigorOf, type Genome } from './genetics';
import {
  Individual,
  SPERM,
  bodyMass,
  fightPower,
  hokoDisplay,
  isAdultFemale,
  isBreedingMale,
  spermCapacity,
  spermDaily,
  testisMass,
  tacticLabel,
  type DeathCause,
} from './individual';
import { geneticHoko, potentialStars, starText } from './lineage';
import { randomName } from './names';
import { Rng } from './rng';
import { type Tag } from './thought-variants';
import { makeThought, type ThoughtKey } from './thoughts';

export const BREED_DAYS = 40;
/** 環境収容力の目安（総個体数） */
export const CARRYING = 170;

export type Stance =
  | { kind: 'challenge'; targetId: number }
  | { kind: 'guard' }
  | { kind: 'rest' }
  | { kind: 'roam' }
  | { kind: 'follow'; slot: number }
  | { kind: 'infiltrate'; slot: number }
  // 主だけが選べる：ハーレムのメスに自分から迫る／世話をさせる
  | { kind: 'court'; femaleId: number }
  | { kind: 'groom'; femaleId: number; type: GroomType }
  // 主がメスのご機嫌を取る
  | { kind: 'tend'; femaleId: number }
  | { kind: 'escort'; femaleId: number }
  | { kind: 'soothe' }
  // 主のおまかせ：毎朝ハーレムの様子を見て、上のどれかを自動で選ぶ
  | { kind: 'auto' };

/** 主が一頭のメスにかかりきりになる方針（その日限り） */
const ONE_DAY_HOLDER_STANCES = new Set(['court', 'groom', 'tend', 'escort', 'soothe']);

export type GroomType = 'hoko' | 'wound' | 'fur';

/** 世話の言い回し。後ろに「させる」「してもらった」を付けて使う。ホコはなめて綺麗にする。 */
export type HokoCare = 'splash' | 'crab' | 'gull';
/** メスがホコのためにしてくれる、ちょっとしたこと（効き目はない） */
export const HOKO_CARE: Record<HokoCare, string> = {
  splash: 'がホコに海水をかけて湿らせてくれた',
  crab: 'がホコを狙うカニを追い払ってくれた',
  gull: 'がホコをつつきに来たカモメを追い払ってくれた',
};

export const GROOM_ACT: Record<GroomType, string> = { hoko: 'ホコをなめて綺麗に', wound: '傷の手当てを', fur: '毛づくろいを' };

export type ForageStrategy = 'cautious' | 'normal' | 'greedy';

export type Prompt =
  | {
      kind: 'challenged';
      opponentId: number;
      perceivedOpp: number;
      self: number;
      slotAtStake: boolean;
    }
  | {
      kind: 'escalate';
      opponentId: number;
      perceivedOpp: number;
      self: number;
      oppBody: number;
      selfBody: number;
      /** 取っ組み合いでプレイヤーが勝つ見込み */
      winChance: number;
      /** プレイヤーが挑んだ側か */
      challenger: boolean;
    };

export type Answer = 'accept' | 'retreat';

export type WorldEvent =
  | { kind: 'display'; aId: number; bId: number; winnerId: number; slot: number | null; withdrew?: boolean }
  | { kind: 'fight'; aId: number; bId: number; winnerId: number; slot: number | null }
  | { kind: 'takeover'; slot: number; newId: number; oldId: number | null }
  | { kind: 'mate'; maleId: number; femaleId: number; how: 'holder' | 'satellite' | 'sneaker' | 'peripheral' }
  | { kind: 'groom'; femaleId: number; maleId: number; type: 'hoko' | 'wound' | 'fur' }
  | { kind: 'tend'; maleId: number; femaleId: number }
  | { kind: 'hokoCare'; maleId: number; femaleId: number; what: HokoCare }
  | { kind: 'soothe'; maleId: number; slot: number }
  | { kind: 'birth'; motherId: number; pupId: number }
  | { kind: 'crushed'; pupId: number; motherId: number }
  | { kind: 'move'; femaleId: number; from: number | null; to: number }
  | { kind: 'chase'; holderId: number; intruderId: number }
  | { kind: 'abandon'; maleId: number; slot: number };

export type LogKind = 'player' | 'dynasty' | 'event' | 'thought';

export interface LogEntry {
  year: number;
  day: number;
  text: string;
  kind: LogKind;
  indId?: number;
}

export interface YearStats {
  year: number;
  population: number;
  adultMales: number;
  adultFemales: number;
  births: number;
  /** 成熟オスの遺伝的なホコ基本長の平均（cm） */
  hokoMean: number;
  testisMean: number;
  bodyMean: number;
  prefMean: number;
  /** 対立遺伝子頻度 */
  freqS: number;
  freqF: number;
  delLoadMean: number;
  /** 血統占有率 */
  dynastyShare: number;
  dynastyCount: number;
  /** 一族と群れ全体の、ホコの遺伝的な平均（cm） */
  dynastyGeneticHoko: number;
  herdGeneticHoko: number;
  /** その年の子のうち、主型・衛星型・忍び型の父をもつ割合 */
  paternityByTactic: { R: number; S: number; F: number };
}

export interface SeasonSummary {
  year: number;
  playerMatings: number;
  playerWasHolder: boolean;
  playerPeakHarem: number;
  playerDisplays: [number, number];
  playerFights: [number, number];
  conceptions: number;
  playerConceptions: number;
}

export interface ForageReport {
  deaths: { id: number; name: string; cause: DeathCause; dynasty: number; age: number }[];
  playerDied: boolean;
  playerCause: DeathCause | null;
  conditionDelta: number;
  /** この冬に超えた血統占有率の節目 */
  milestones: number[];
}

export interface ChallengeTarget {
  id: number;
  perceived: number;
  isHolder: boolean;
  slot: number | null;
  elo: number;
}

/** 決定論的な擬似正規乱数：同じ観察者・対象・日なら同じ値（UI の推定値と勝負の判断を一致させる） */
function hashNormal(a: number, b: number, c: number): number {
  const mix = (x: number) => {
    x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
    return (x ^ (x >>> 16)) >>> 0;
  };
  const h1 = mix(a * 73856093 + mix(b * 19349663 + mix(c * 83492791)));
  const h2 = mix(h1 + 0x9e3779b9);
  const u = (h1 + 1) / 4294967297;
  const v = h2 / 4294967296;
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export class World {
  rng: Rng;
  year = 0;
  day = 0;
  phase: 'breeding' | 'foraging' = 'foraging';
  inds = new Map<number, Individual>();
  private nextId = 1;
  /** 各ハーレム枠の主 */
  slotHolders: (number | null)[] = [];
  /** 枠ごとの騒がしさ（喧嘩・追い払い） */
  slotHarass: number[] = [];
  playerId: number | null = null;
  founderId: number | null = null;
  /** 初代を選んだ年（表示上の 1 年目） */
  startYear = 0;
  generation = 1;
  playerStance: Stance = { kind: 'roam' };
  log: LogEntry[] = [];
  dayEvents: WorldEvent[] = [];
  history: YearStats[] = [];
  /** 歴代当主 */
  heads: HeadRecord[] = [];
  /** 一族最高のホコの素質 */
  bestHoko: { id: number; name: string; value: number; year: number } | null = null;
  /** 達成した血統占有率の節目 */
  milestonesReached: number[] = [];
  private birthsThisYear = 0;
  private slotCache: Map<number, Individual[]> | null = null;
  /** 主のとき、おまかせを選んでいるか */
  holderAuto = true;
  /** プレイヤーが主なのに、メスが一頭もいない日が続いた日数 */
  /** 群れの誰かがその文を最後に言った日（year*100+day） */
  private saidRecently = new Map<string, number>();
  /** プレイヤーの浜にメスがいない日が何日続いているか */
  emptyHaremDays = 0;
  /** 今日の行動をおまかせで決めたか（翌朝またおまかせに戻す） */
  private autoToday = false;
  /** 今日プレイヤーがなだめた浜 */
  private soothedSlot: number | null = null;
  /** 枠ごとの衛星型の数（メスの居場所選びで使う。日の始めに数える） */
  private satelliteCount: number[] = [];
  private paternity = { R: 0, S: 0, F: 0 };
  private conceptionsThisYear = 0;
  private playerConceptions = 0;

  constructor(seed: number) {
    this.rng = new Rng(seed);
  }

  // ───────────────────────── 生成 ─────────────────────────

  static create(seed: number, burnInYears = 40): World {
    const w = new World(seed);
    w.seedPopulation();
    for (let y = 0; y < burnInYears; y++) w.simulateYearAuto();
    w.day = 0;
    w.log = [];
    w.history = w.history.slice(-1);
    return w;
  }

  private seedPopulation(): void {
    const ageDist = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 9, 10, 11, 12];
    for (let i = 0; i < 160; i++) {
      const sex = i % 2 === 0 ? 'M' : 'F';
      let genome: Genome;
      do genome = randomGenome(sex, this.rng);
      while (tacticOf(genome) === null);
      const age = this.rng.pick(ageDist);
      const ind = this.addIndividual(genome, null, null, this.year - age);
      ind.condition = this.rng.range(0.5, 0.8);
    }
  }

  private addIndividual(genome: Genome, mother: Individual | null, fatherId: number | null, birthYear: number): Individual {
    const taken = new Set<string>();
    for (const i of this.inds.values()) if (i.alive) taken.add(i.name);
    const ind = new Individual({
      id: this.nextId++,
      name: randomName(genome.sex, this.rng, taken),
      genome,
      motherId: mother?.id ?? null,
      fatherId,
      birthYear,
      rng: this.rng,
    });
    this.inds.set(ind.id, ind);
    return ind;
  }

  living(): Individual[] {
    const out: Individual[] = [];
    for (const i of this.inds.values()) if (i.alive) out.push(i);
    return out;
  }

  get(id: number | null | undefined): Individual | undefined {
    return id == null ? undefined : this.inds.get(id);
  }

  get player(): Individual | undefined {
    return this.get(this.playerId);
  }

  age(ind: Individual): number {
    return ind.ageAt(this.year);
  }

  hoko(ind: Individual): number {
    return hokoDisplay(ind, this.year);
  }

  /** 観察者から見た対象のホコの推定長。測り間違いを含む。 */
  perceivedHoko(observer: Individual, target: Individual): number {
    if (observer.id === target.id) return this.hoko(target);
    // 見誤りは相手ごとに一年を通して同じ（見るたびに変わらない）
    const noise = hashNormal(observer.id, target.id, this.year);
    return this.hoko(target) * (1 + 0.06 * noise);
  }

  // ───────────────────────── プレイヤー ─────────────────────────

  /** 初代の候補：6〜7 歳の若いオスから 3 頭（主型を 2 頭以上） */
  founderCandidates(): Individual[] {
    return this.founderOptions().map((o) => o.ind);
  }

  /**
   * 初代の候補を、難しさの違う 4 種類から用意する：
   * 大物（素質が最も高い）・並（群れの中ほど）・小兵（素質は低いが精巣の大きい者）・変わり種（衛星型か忍び型）
   */
  founderOptions(): FounderOption[] {
    const pool = (lo: number, hi: number) =>
      this.living().filter((i) => i.sex === 'M' && this.age(i) >= lo && this.age(i) <= hi && this.slotOf(i) === null);
    let r = pool(6, 7).filter((m) => m.base.tactic === 'R');
    if (r.length < 6) r = pool(5, 8).filter((m) => m.base.tactic === 'R');
    r.sort((a, b) => b.base.hoko - a.base.hoko);
    const out: FounderOption[] = [];
    const used = new Set<number>();
    const take = (ind: Individual | undefined, kind: FounderOption['kind']) => {
      if (!ind || used.has(ind.id)) return;
      used.add(ind.id);
      out.push({ ind, kind });
    };
    take(r[0], 'big');
    // 並：群れの平均にいちばん近い者
    const mean = this.herdHokoMean();
    const upper = r.slice(1, Math.max(2, Math.floor((r.length * 2) / 3)));
    take([...upper].sort((a, b) => Math.abs(a.base.hoko - mean) - Math.abs(b.base.hoko - mean))[0], 'mid');
    // 小兵：下位 3 分の 1 の中で、精巣がいちばん大きい者
    const low = r.slice(Math.floor((r.length * 2) / 3));
    take([...low].sort((a, b) => b.base.testis - a.base.testis)[0], 'small');
    const odd = this.rng.shuffle(pool(5, 8).filter((m) => m.base.tactic !== 'R'));
    take(odd[0], 'odd');
    return out;
  }

  choosePlayer(id: number, asFounder: boolean): void {
    this.playerId = id;
    const p = this.inds.get(id)!;
    if (asFounder) {
      this.founderId = id;
      this.generation = 1;
      this.startYear = this.year;
      p.condition = Math.max(p.condition, 0.7);
      p.injury = 0;
      // 初代がすでに残している子孫も含めて、家系図から血統の割合を計算し直す（ID は生まれ順）
      const ordered = [...this.inds.values()].sort((a, b) => a.id - b.id);
      for (const i of ordered) {
        if (i.id === id) i.dynasty = 1;
        else {
          const m = this.get(i.motherId);
          const f = this.get(i.fatherId);
          i.dynasty = ((m?.dynasty ?? 0) + (f?.dynasty ?? 0)) / 2;
        }
      }
    } else {
      this.generation++;
    }
    this.closeHead();
    this.heads.push({
      id: p.id,
      name: p.name,
      generation: this.generation,
      fromYear: this.year,
      toYear: null,
      cause: null,
      potential: p.base.hoko,
      herdMean: this.herdHokoMean(),
      peakHarem: 0,
    });
    if (asFounder) this.bestHoko = { id: p.id, name: p.name, value: p.base.hoko, year: this.year };
    // 主になったら、まずは「おまかせ」。守りに徹したいときは「守る」を選ぶ。
    this.holderAuto = true;
    this.playerStance = this.defaultStance(p);
    this.pushLog(`${p.name}として生きる。`, 'player', p.id);
  }

  /** 跡継ぎ候補：初代の血を引く生きているオス（血の濃い順） */
  heirCandidates(): Individual[] {
    return this.living()
      .filter((i) => i.sex === 'M' && i.dynasty > 0)
      .sort((a, b) => {
        const pa = this.isChildOfPlayerLine(a) ? 1 : 0;
        const pb = this.isChildOfPlayerLine(b) ? 1 : 0;
        return pb - pa || b.dynasty - a.dynasty || this.age(b) - this.age(a);
      });
  }

  private isChildOfPlayerLine(ind: Individual): boolean {
    return ind.fatherId === this.playerId;
  }

  /**
   * きのう（直前に進めた 1 日）にプレイヤーの身に起きたことの要約。
   * 同じ種類の出来事は名前をまとめて 1 行にする。
   */
  playerDigest(): string[] {
    const p = this.player;
    if (!p || this.phase !== 'breeding') return [];
    const pid = p.id;
    const s = this.slotOf(p);
    const name = (id: number) => this.get(id)?.name ?? '―';
    const group = new Map<string, string[]>();
    const add = (key: string, who: string) => {
      const list = group.get(key) ?? [];
      if (!list.includes(who)) list.push(who);
      group.set(key, list);
    };
    const lines: string[] = [];
    for (const e of this.dayEvents) {
      switch (e.kind) {
        case 'display':
        case 'fight':
          if (e.aId === pid || e.bId === pid) {
            const opp = name(e.aId === pid ? e.bId : e.aId);
            if (e.kind === 'display' && e.withdrew) lines.push(`${opp}とのにらみ合いから身を引いた`);
            else lines.push(`${e.kind === 'display' ? '見せ合い' : '取っ組み合い'}で${opp}に${e.winnerId === pid ? '勝った' : '負けた'}`);
          }
          break;
        case 'takeover':
          if (e.newId === pid) lines.push('浜とハーレムを手に入れた');
          if (e.oldId === pid) lines.push('浜とハーレムを失った');
          break;
        case 'mate':
          if (e.maleId === pid) add('とつがった', name(e.femaleId));
          else if (s !== null && this.get(e.femaleId)?.slot === s) add(`がほかのオスとつがった`, name(e.femaleId));
          break;
        case 'groom':
          if (e.maleId === pid) add(`に${GROOM_ACT[e.type]}してもらった`, name(e.femaleId));
          break;
        case 'tend':
          if (e.maleId === pid) add('に構った', name(e.femaleId));
          break;
        case 'hokoCare':
          if (e.maleId === pid) add(HOKO_CARE[e.what], name(e.femaleId));
          break;
        case 'soothe':
          if (e.maleId === pid) lines.push('ハーレムをなだめた');
          break;
        case 'move':
          if (s !== null && e.to === s) add('が加わった', name(e.femaleId));
          else if (s !== null && e.from === s) add('が去った', name(e.femaleId));
          break;
        case 'birth': {
          const pup = this.get(e.pupId);
          if (pup?.fatherId === pid) add('があなたの子を産んだ', name(e.motherId));
          break;
        }
        case 'crushed':
          if (s !== null && this.get(e.motherId)?.slot === s) add('の子が喧嘩で踏まれた', name(e.motherId));
          break;
        case 'chase':
          if (e.holderId === pid) add('を追い払った', name(e.intruderId));
          if (e.intruderId === pid) lines.push(`${name(e.holderId)}に見つかって追い払われた`);
          break;
        case 'abandon':
          if (e.maleId === pid) lines.push('脂肪が尽きて浜を離れた');
          break;
      }
    }
    for (const [key, who] of group) {
      const names = who.length > 3 ? `${who.slice(0, 3).join('・')}ほか${who.length - 3}頭` : who.join('・');
      lines.push(`${names}${key}`);
    }
    return lines;
  }

  /**
   * 自分の欄に出すセリフ。前の日にハーレムのメスが言ったことがあれば、それを優先する。
   * あなたに向けたセリフ（手入れ・交尾・構ってもらったときなど）を先に選ぶ。
   */
  featuredThought(): { speaker: Individual; text: string } | null {
    const p = this.player;
    if (!p) return null;
    const own = p.thought ? { speaker: p, text: p.thought.text } : null;
    const s = this.slotOf(p);
    if (this.phase !== 'breeding' || s === null) return own;
    const fs = this.slotFemales(s);
    const pups = fs.map((f) => (f.pupId != null ? this.get(f.pupId) : undefined)).filter((x): x is Individual => !!x && x.alive);
    const recent = [...fs, ...pups].filter((f) => f.thought && f.thought.year === this.year && f.thought.day === this.day - 1);
    if (recent.length === 0) return own;
    const rank = (f: Individual) => {
      const t = f.thought!;
      const i = FEMALE_LINE_PRIORITY.indexOf(t.key ?? '');
      return (t.aboutId === p.id ? 0 : 100) + (i < 0 ? 50 : i);
    };
    const best = [...recent].sort((a, b) => rank(a) - rank(b) || a.id - b.id)[0];
    return { speaker: best, text: best.thought!.text };
  }

  /** 当主不在のまま年を進め、血を引くオスが生まれるのを待つ。経過年数を返す。 */
  /** 一族の子を身ごもっているメス（父が一族） */
  carriersOfLine(): Individual[] {
    return this.living().filter((f) => f.sex === 'F' && f.pregnancy && (this.get(f.pregnancy.fatherId)?.dynasty ?? 0) > 0);
  }

  /** 血がまだ残っているか（生きている一族、または一族の子を宿したメス） */
  lineSurvives(): boolean {
    return this.living().some((i) => i.dynasty > 0) || this.carriersOfLine().length > 0;
  }

  waitForHeir(maxYears: number): number {
    const keepPlayer = this.playerId;
    this.playerId = null;
    let n = 0;
    while (n < maxYears && this.heirCandidates().length === 0 && this.lineSurvives()) {
      this.simulateYearAuto();
      n++;
    }
    this.playerId = keepPlayer;
    return n;
  }

  /** 成熟した主型オスの、ホコの素質の平均 */
  herdHokoMean(): number {
    const last = this.history[this.history.length - 1];
    if (last && last.hokoMean > 0) return last.hokoMean;
    const ms = this.living().filter((m) => m.sex === 'M' && m.base.tactic === 'R' && this.age(m) >= 6);
    return ms.length ? ms.reduce((s, m) => s + m.base.hoko, 0) / ms.length : 40;
  }

  /** いまの当主の記録を閉じる */
  private closeHead(): void {
    const h = this.heads[this.heads.length - 1];
    if (!h || h.toYear !== null) return;
    const ind = this.get(h.id);
    if (ind && !ind.alive) {
      h.toYear = ind.deathYear;
      h.cause = ind.deathCause;
    }
  }

  /** 血統占有率の節目。超えたものを返す。 */
  checkMilestones(): number[] {
    const living = this.living();
    const share = living.reduce((s, i) => s + i.dynasty, 0) / Math.max(1, living.length);
    const hit = MILESTONES.filter((m) => share >= m && !this.milestonesReached.includes(m));
    for (const m of hit) {
      this.milestonesReached.push(m);
      this.pushLog(`節目：血統占有率が${Math.round(m * 100)}%を超えた！`, 'dynasty');
    }
    return hit;
  }

  defaultStance(p: Individual): Stance {
    if (p.base.tactic === 'S') return { kind: 'follow', slot: this.bestSlotBySize() };
    if (p.base.tactic === 'F') return { kind: 'infiltrate', slot: this.bestSlotBySize() };
    if (this.slotOf(p) !== null) return this.holderAuto ? { kind: 'auto' } : { kind: 'guard' };
    return { kind: 'roam' };
  }

  /** おまかせの判断：騒がしければなだめ、機嫌の悪いメスに構い、守りの手薄な発情メスに寄り添う */
  private resolveAutoStance(p: Individual): Stance {
    const s = this.slotOf(p);
    if (s === null) return { kind: 'roam' };
    const fs = this.slotFemales(s);
    // メスのいない浜は守っても仕方がない。海で食べて蓄える。
    if (fs.length === 0) return { kind: 'rest' };
    // 痩せてきたら、発情の近いメスがいない日に海で食べる
    const soonEstrus = fs.some((f) => f.estrusStart >= 0 && f.estrusStart + 3 > this.day && f.estrusStart <= this.day + 2);
    if (p.condition < 0.25 && !soonEstrus) return { kind: 'rest' };
    if (this.slotHarass[s] > 0.6) return { kind: 'soothe' };
    const cap = this.guardCap(p);
    // 見張りの外にいる発情メスがいれば、そばについて他のオスから守る
    const exposed = fs.findIndex((f, i) => i >= cap && this.femaleStatus(f).estrus);
    if (exposed >= 0) return { kind: 'escort', femaleId: fs[exposed].id };
    const sulky = [...fs].sort((a, b) => a.loyalty - b.loyalty)[0];
    if (sulky.loyalty < 0.15 && fs.length >= 2 && this.rng.chance(0.5)) return { kind: 'tend', femaleId: sulky.id };
    const fond = fs.find((f) => f.loyalty > 0.4);
    if (fond && p.injury > 0.15) return { kind: 'groom', femaleId: fond.id, type: 'wound' };
    if (fond && p.shine < 0.03 && this.rng.chance(0.35)) return { kind: 'groom', femaleId: fond.id, type: 'hoko' };
    return { kind: 'guard' };
  }

  displayYear(y = this.year): number {
    return y - this.startYear + 1;
  }

  setPlayerStance(s: Stance): void {
    this.playerStance = s;
    if (s.kind === 'auto') this.holderAuto = true;
    else if (s.kind === 'guard') this.holderAuto = false;
    const p = this.player;
    if (!p) return;
    if (s.kind === 'follow' || s.kind === 'infiltrate') p.slot = s.slot;
  }

  /** 浜にいる主型オス（5 歳以上）の中での序列 */
  rankOf(ind: Individual): { rank: number; of: number } | null {
    if (ind.sex !== 'M' || ind.base.tactic !== 'R') return null;
    const males = this.living()
      .filter((m) => m.sex === 'M' && m.base.tactic === 'R' && this.age(m) >= 5 && (m.onBeach || this.phase === 'foraging'))
      .sort((a, b) => b.elo - a.elo);
    const idx = males.findIndex((m) => m.id === ind.id);
    return idx < 0 ? null : { rank: idx + 1, of: males.length };
  }

  canAct(p: Individual): boolean {
    return isBreedingMale(p, this.year) && p.onBeach;
  }

  challengeTargets(): ChallengeTarget[] {
    const p = this.player;
    if (!p) return [];
    return this.living()
      .filter((m) => m.id !== p.id && m.sex === 'M' && m.onBeach && this.age(m) >= 4 && m.base.tactic === 'R')
      .map((m) => ({
        id: m.id,
        perceived: this.perceivedHoko(p, m),
        isHolder: this.slotOf(m) !== null,
        slot: this.slotOf(m),
        elo: m.elo,
      }))
      .sort((a, b) => b.perceived - a.perceived);
  }

  // ───────────────────────── ハーレム枠 ─────────────────────────

  slotOf(m: Individual): number | null {
    const idx = this.slotHolders.indexOf(m.id);
    return idx >= 0 ? idx : null;
  }

  /** 枠にいる成熟メス（愛着の強い順）。枠の割り当てが変わるまでキャッシュする。 */
  slotFemales(slot: number): Individual[] {
    if (!this.slotCache) {
      this.slotCache = new Map();
      for (const i of this.inds.values()) {
        if (i.alive && i.onBeach && i.sex === 'F' && i.slot !== null && isAdultFemale(i, this.year)) {
          let list = this.slotCache.get(i.slot);
          if (!list) this.slotCache.set(i.slot, (list = []));
          list.push(i);
        }
      }
    }
    const list = this.slotCache.get(slot);
    if (!list) return [];
    return list.sort((a, b) => b.loyalty - a.loyalty);
  }

  private invalidateSlots(): void {
    this.slotCache = null;
  }

  /** 主が見張れるメスの数 */
  guardCap(holder: Individual): number {
    let guarding = 1;
    if (holder.id === this.playerId) {
      const k = this.playerStance.kind;
      // 守りに徹すれば広く見張れる。一頭にかまけていると見張りが手薄になる。
      if (k === 'guard') guarding = 1.3;
      else if (k === 'rest') guarding = 0.4; // 海に出ている間は見張れない
      else if (k === 'soothe') guarding = 0.95;
      else if (ONE_DAY_HOLDER_STANCES.has(k)) guarding = 0.85;
    }
    return Math.max(2, Math.round(3 + 13 * holder.condition * guarding * (0.7 + 0.3 * holder.base.vigor)));
  }

  private bestSlotBySize(): number {
    let best = 0;
    let bestN = -1;
    for (let s = 0; s < this.slotHolders.length; s++) {
      if (this.slotHolders[s] == null) continue;
      const n = this.slotFemales(s).length;
      if (n > bestN) {
        bestN = n;
        best = s;
      }
    }
    return best;
  }

  private eligibleHolder(m: Individual): boolean {
    return m.alive && m.onBeach && m.sex === 'M' && m.base.tactic === 'R' && this.age(m) >= 6 && m.condition > 0.2;
  }

  private fillEmptySlots(): void {
    for (let s = 0; s < this.slotHolders.length; s++) {
      if (this.slotHolders[s] != null) continue;
      // 序列（評判）とホコの大きさの両方で、いちばん強そうな者が空いた浜に入る
      const score = (m: Individual) => m.elo + 12 * this.hoko(m);
      const cands = this.living()
        .filter((m) => this.eligibleHolder(m) && this.slotOf(m) === null)
        .sort((a, b) => score(b) - score(a));
      const m = cands[0];
      if (!m) continue;
      this.slotHolders[s] = m.id;
      m.slot = s;
      for (const f of this.slotFemales(s)) f.loyalty = f.loyalty * 0.2 + 0.2 * f.warmth;
      this.dayEvents.push({ kind: 'takeover', slot: s, newId: m.id, oldId: null });
      this.think(m, 'takeHarem', { other: '空き' });
      if (m.id === this.playerId) {
        this.pushLog(`空いた浜を手に入れた。ハーレムの主になった！`, 'player', m.id);
        this.playerStance = this.defaultStance(this.player!);
      }
    }
  }

  private vacateSlot(m: Individual): void {
    const s = this.slotOf(m);
    if (s === null) return;
    this.slotHolders[s] = null;
    m.slot = null;
  }

  // ───────────────────────── 繁殖期 ─────────────────────────

  startBreedingSeason(): void {
    this.phase = 'breeding';
    this.day = 0;
    this.birthsThisYear = 0;
    this.paternity = { R: 0, S: 0, F: 0 };
    this.conceptionsThisYear = 0;
    this.playerConceptions = 0;
    const living = this.living();
    const adultF = living.filter((i) => isAdultFemale(i, this.year)).length;
    const nSlots = Math.max(3, Math.min(9, Math.round(adultF / 6)));
    // 前年の主は、条件を満たす限り枠を保つ
    const prev = this.slotHolders.slice(0, nSlots);
    while (prev.length < nSlots) prev.push(null);
    this.slotHolders = prev;
    this.slotHarass = new Array(nSlots).fill(0);

    for (const ind of living) {
      ind.season = { matings: 0, displaysWon: 0, displaysLost: 0, fightsWon: 0, fightsLost: 0, groomed: 0, peakHarem: 0 };
      ind.onBeach = true;
      ind.foughtToday = false;
      ind.lastLossDay = -99;
      ind.seasonCondition = ind.condition;
      ind.spermStore = [];
      ind.estrusStart = -1;
      ind.birthDay = -1;
      ind.shine = 0;
      ind.loyalty = 0;
      ind.slot = null;
      ind.pupId = null;
      ind.thought = null;
      if (ind.sex === 'M') ind.sperm = spermCapacity(ind, this.year);
      if (isAdultFemale(ind, this.year)) {
        if (ind.pregnancy) {
          ind.birthDay = this.rng.int(0, 8);
          ind.estrusStart = ind.birthDay + this.rng.int(17, 21);
        } else {
          ind.estrusStart = this.rng.int(10, 26);
        }
      }
    }
    this.invalidateSlots();
    for (let s = 0; s < nSlots; s++) {
      const h = this.get(this.slotHolders[s]);
      if (!h || !this.eligibleHolder(h) || h.condition < 0.25) this.slotHolders[s] = null;
      else h.slot = s;
    }
    this.dayEvents = [];
    this.fillEmptySlots();
    // 衛星型・忍び型は付き従う枠を決める
    for (const m of living) {
      if (m.sex !== 'M' || this.age(m) < 4) continue;
      if (m.base.tactic !== 'R' && m.id !== this.playerId) m.slot = this.pickSlotWeighted();
    }
    // メスは最初の居場所を選ぶ
    for (const f of living) if (isAdultFemale(f, this.year)) this.femaleChoose(f, true);
    const p = this.player;
    if (p) {
      this.playerStance = this.defaultStance(p);
      if (p.base.tactic !== 'R' && (this.playerStance.kind === 'follow' || this.playerStance.kind === 'infiltrate')) {
        p.slot = this.playerStance.slot;
      }
      this.pushLog(`${this.displayYear()}年目の繁殖期が始まった。メスたちは浜に着くと、どの主のもとにいるかを選び直す。`, 'event');
    }
  }

  private pickSlotWeighted(): number | null {
    const slots = this.slotHolders.map((_, i) => i).filter((s) => this.slotHolders[s] != null);
    return this.rng.weighted(slots, (s) => 1 + this.slotFemales(s).length) ?? null;
  }

  /** 1 日を進める。プレイヤーの判断が必要なときは Prompt を yield する。 */
  *runDay(): Generator<Prompt, void, Answer> {
    this.dayEvents = [];
    const y = this.year;
    const living = this.living().filter((i) => i.onBeach);

    // おまかせなら、今朝の様子を見て今日の行動を決める
    const pl = this.player;
    this.autoToday = false;
    if (pl && this.playerStance.kind === 'auto') {
      this.autoToday = true;
      this.playerStance = this.resolveAutoStance(pl);
      if (this.playerStance.kind !== 'guard') this.pushLog(`おまかせ：${autoLabel(this, this.playerStance)}`, 'player', pl.id);
    }
    // 1. 日の始まり：絶食による消耗、精子の産生、ツヤの減衰
    for (const ind of living) {
      ind.foughtToday = false;
      ind.shine *= 0.94;
      const holder = ind.sex === 'M' && this.slotOf(ind) !== null;
      let drain: number;
      // 主は絶食で浜を守る。周辺のオスはときどき海へ出て食べる。
      if (ind.sex === 'M') drain = holder ? 0.011 : this.age(ind) >= 4 ? 0.0035 : 0.002;
      else drain = ind.pupId ? 0.009 : 0.005;
      // 「海で食べる」日は、痩せるどころか少し戻る
      if (ind.id === this.playerId && this.playerStance.kind === 'rest') drain = -0.012;
      ind.condition = Math.min(1, Math.max(0, ind.condition - drain));
      if (ind.sex === 'M') ind.sperm = Math.min(spermCapacity(ind, y), ind.sperm + spermDaily(ind, y));
      ind.injury = Math.max(0, ind.injury - 0.008);
    }

    // 2. 出産
    for (const f of living) {
      if (f.sex === 'F' && f.birthDay === this.day && f.pregnancy) this.giveBirth(f);
    }

    // 3. 主の消耗による退場
    for (let s = 0; s < this.slotHolders.length; s++) {
      const h = this.get(this.slotHolders[s]);
      if (!h) continue;
      if (h.condition < 0.13 || !h.alive) {
        this.vacateSlot(h);
        h.onBeach = false;
        this.dayEvents.push({ kind: 'abandon', maleId: h.id, slot: s });
        this.think(h, 'abandon', {});
        if (h.id === this.playerId) this.pushLog('脂肪が尽きた。ハーレムを捨てて海へ帰った。', 'player', h.id);
      } else if (h.condition < 0.25 && this.rng.chance(0.15)) {
        this.think(h, 'hungry', {});
      }
    }
    this.fillEmptySlots();
    // 痩せ細った周辺のオスは、浜をあきらめて海へ食べに出る
    for (const m of living) {
      if (m.sex !== 'M' || !m.onBeach || this.slotOf(m) !== null || this.age(m) < 4 || m.condition >= 0.1) continue;
      m.onBeach = false;
      m.slot = null;
      if (m.id === this.playerId) {
        this.pushLog('腹が減って動けない。今季はあきらめて海へ食べに出た。', 'player', m.id);
        this.think(m, 'abandon', {});
      }
    }

    // メスのいない日を数える（3 日続いたら、画面のほうでどうするか聞く）
    const ps = pl ? this.slotOf(pl) : null;
    if (pl && ps !== null && this.slotFemales(ps).length === 0) this.emptyHaremDays++;
    else this.emptyHaremDays = 0;
    // 痩せすぎの警告
    if (pl && pl.onBeach && pl.sex === 'M' && this.age(pl) >= 4 && pl.condition < 0.2 && this.day % 3 === 0) {
      this.pushLog(`脂肪が${Math.round(pl.condition * 100)}%しかない。10%を切ると浜にいられなくなる。「海で食べる」で取り戻そう。`, 'player', pl.id);
    }

    // 4. 見せ合いと取っ組み合い
    yield* this.contestPhase();

    // 5. メスの移動（主がなだめた浜では、出ていくメスが減る）
    this.playerSoothe();
    this.satelliteCount = this.slotHolders.map(() => 0);
    for (const [s, list] of this.tacticBySlot('S')) this.satelliteCount[s] = list.length;
    for (const f of this.living()) {
      if (f.onBeach && isAdultFemale(f, y)) this.femaleChoose(f, false);
    }

    // 6. 手入れ
    this.groomingPhase();

    // 7. 交尾
    this.matingPhase();

    // 8. 発情が終わったメスの受精
    for (const f of this.living()) {
      if (f.sex === 'F' && f.estrusStart >= 0 && this.day === f.estrusStart + 3) this.resolveConception(f);
    }

    // 9. ハーレムの記録と雑多なつぶやき
    for (let s = 0; s < this.slotHolders.length; s++) {
      this.slotHarass[s] *= 0.75;
      const h = this.get(this.slotHolders[s]);
      if (h) h.season.peakHarem = Math.max(h.season.peakHarem, this.slotFemales(s).length);
    }
    this.youngReactions();
    this.ambientThoughts();

    // 一頭への働きかけはその日限り。翌日からは浜を守る。
    const pk = this.playerStance.kind;
    if ((ONE_DAY_HOLDER_STANCES.has(pk) || this.autoToday) && this.player) this.playerStance = this.defaultStance(this.player);
    this.soothedSlot = null;

    this.day++;
  }

  private *contestPhase(): Generator<Prompt, void, Answer> {
    const p = this.player;
    const challengers: Individual[] = [];
    for (const m of this.living()) {
      if (!m.onBeach || m.sex !== 'M' || m.base.tactic !== 'R' || this.age(m) < 5 || m.condition < 0.15) continue;
      if (m.id === this.playerId) continue;
      if (this.slotOf(m) !== null) continue;
      if (this.day - m.lastLossDay < 4) continue;
      const pChallenge = 0.1 * (0.4 + m.base.boldness) * (0.5 + m.condition);
      if (this.rng.chance(pChallenge)) challengers.push(m);
    }
    this.rng.shuffle(challengers);
    // プレイヤーの挑戦は先に処理する
    if (p && this.playerStance.kind === 'challenge' && this.canAct(p)) {
      const t = this.get(this.playerStance.targetId);
      if (t && t.alive && t.onBeach) {
        yield* this.contest(p, t);
      } else {
        this.pushLog('挑む相手が見当たらなかった。', 'player', p.id);
      }
      this.playerStance = this.defaultStance(p);
    }
    for (const a of challengers) {
      if (a.foughtToday || !a.alive) continue;
      const b = this.chooseTarget(a);
      if (!b || b.foughtToday) continue;
      yield* this.contest(a, b);
    }
  }

  private chooseTarget(a: Individual): Individual | undefined {
    const tolerance = 1.04 + 0.12 * a.base.aggression + a.base.hubris;
    const self = this.hoko(a);
    const holders = this.slotHolders.map((id) => this.get(id)).filter((h): h is Individual => !!h && h.onBeach);
    // ハーレムの主の中で、勝てそうな相手。評判（序列）が自分よりずっと上の主は避ける。
    const winnable = holders.filter((h) => this.perceivedHoko(a, h) / self < tolerance && h.elo < a.elo + 120);
    if (winnable.length > 0 && this.rng.chance(0.7)) {
      return this.rng.weighted(winnable, (h) => 1 + this.slotFemales(this.slotOf(h)!).length);
    }
    // それ以外：Elo の近い周辺オスと序列を争う
    const peers = this.living().filter(
      (m) =>
        m.id !== a.id &&
        m.onBeach &&
        m.sex === 'M' &&
        m.base.tactic === 'R' &&
        this.age(m) >= 5 &&
        this.slotOf(m) === null &&
        Math.abs(m.elo - a.elo) < 150,
    );
    return peers.length ? this.rng.pick(peers) : undefined;
  }

  /**
   * プレイヤーが opp に挑んだときの見立て。勝負と同じ式で、相手が見せ合いで引く見込みを見積もる。
   * 相手の気性・うぬぼれ・こちらの見え方、こちらの見誤りは分からないので、ありそうな範囲で平均する。
   *  displayWin：相手はまず引く（8 割以上）／maybe：引くかは五分／fight：見せ合いでは決まらない／displayLose：相手のほうが大きい
   * pWin は、見せ合いで引かせる見込みと、引かなければ組んで勝つ見込みを合わせたもの。
   */
  challengeVerdict(opp: Individual): { kind: 'displayWin' | 'maybe' | 'displayLose' | 'fight'; odds: number; pRetreat: number; pWin: number } {
    const me = this.player!;
    const resident = this.slotOf(opp) !== null;
    const mine = this.hoko(me);
    const theirs = this.perceivedHoko(me, opp);
    const odds = this.fightOdds(me, opp, false, resident);
    // 決まった種で毎回同じ見積もりにする（一覧を開き直しても変わらない）
    let seed = (me.id * 73856093) ^ (opp.id * 19349663) ^ (this.year * 83492791);
    const rand = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
    const N = 400;
    let retreats = 0;
    for (let i = 0; i < N; i++) {
      const trueTheirs = theirs / (1 + 0.06 * gauss());
      const seen = mine * (1 + 0.06 * gauss());
      const hubris = Math.min(0.3, Math.max(-0.2, 0.05 * gauss()));
      const aggr = Math.min(1, Math.max(0, 0.5 + 0.15 * gauss()));
      if (seen / (trueTheirs * (1 + hubris)) > 1.05 + 0.12 * aggr + (resident ? 0.08 : 0)) retreats++;
    }
    const pRetreat = retreats / N;
    const pWin = pRetreat + (1 - pRetreat) * odds;
    const kind = pRetreat >= 0.8 ? 'displayWin' : pRetreat >= 0.2 ? 'maybe' : theirs / mine > 1.05 ? 'displayLose' : 'fight';
    return { kind, odds, pRetreat, pWin };
  }

  /** 取っ組み合いで me が勝つ確率。浜の主として受ける側には先住効果が付く。 */
  fightOdds(me: Individual, opp: Individual, meResident: boolean, oppResident: boolean): number {
    let pa = fightPower(me, this.year);
    let pb = fightPower(opp, this.year);
    if (meResident) pa *= 1.45 * (me.id === this.playerId && this.playerStance.kind === 'guard' ? 1.15 : 1);
    if (oppResident) pb *= 1.45;
    return 1 / (1 + Math.exp(-4 * Math.log(pa / pb)));
  }

  /** 見せ合い →（必要なら）取っ組み合い。a が挑戦者、b が受ける側。 */
  private *contest(a: Individual, b: Individual): Generator<Prompt, void, Answer> {
    const slot = this.slotOf(b);
    const pid = this.playerId;
    a.foughtToday = true;
    b.foughtToday = true;

    const percAofB = this.perceivedHoko(a, b);
    const percBofA = this.perceivedHoko(b, a);
    const selfA = this.hoko(a) * (1 + a.base.hubris);
    const selfB = this.hoko(b) * (1 + b.base.hubris);

    if (b.id !== pid && a.id !== pid && percAofB / selfA > 1.15) this.think(a, 'rivalBigger', { about: b });

    // 受ける側がプレイヤーなら、受けるか引くかを聞く
    if (b.id === pid) {
      const ans: Answer = yield {
        kind: 'challenged',
        opponentId: a.id,
        perceivedOpp: percBofA,
        self: this.hoko(b),
        slotAtStake: slot !== null,
      };
      if (ans === 'retreat') {
        this.pushLog(`${a.name}の挑戦から逃げた。`, 'player', b.id);
        this.resolveWin(a, b, 'display', slot);
        return;
      }
    }

    // 見せ合い：相手が十分大きく見えたら引く。
    // 先住効果：浜の主は簡単には引かず、挑戦者は主の気迫に押されやすい。
    const resident = slot !== null;
    const thrA = 1.05 + 0.12 * a.base.aggression - (resident ? 0.08 : 0);
    const thrB = 1.05 + 0.12 * b.base.aggression + (resident ? 0.08 : 0);
    const aRetreats = a.id !== pid && percAofB / selfA > thrA;
    const bRetreats = b.id !== pid && percBofA / selfB > thrB;
    if (aRetreats || bRetreats) {
      if (aRetreats) this.resolveWin(b, a, 'display', slot);
      else this.resolveWin(a, b, 'display', slot);
      return;
    }

    // 差がわずか：取っ組み合いに進むか（プレイヤーには聞く）
    if (a.id === pid || b.id === pid) {
      const me = a.id === pid ? a : b;
      const opp = a.id === pid ? b : a;
      const ans: Answer = yield {
        kind: 'escalate',
        opponentId: opp.id,
        perceivedOpp: this.perceivedHoko(me, opp),
        self: this.hoko(me),
        oppBody: bodyMass(opp, this.year),
        selfBody: bodyMass(me, this.year),
        winChance: this.fightOdds(me, opp, slot !== null && me === b, slot !== null && opp === b),
        challenger: me === a,
      };
      if (ans === 'retreat') {
        if (me === a) {
          // 自分から挑んだ勝負は、にらみ合いの段階なら身を引ける（序列の下がり方は半分）
          this.withdraw(me, opp, slot);
          return;
        }
        this.pushLog(`${opp.name}とのにらみ合いで、先に目をそらした。`, 'player', me.id);
        this.resolveWin(opp, me, 'display', slot);
        return;
      }
    }

    // 取っ組み合い
    const pa = fightPower(a, this.year);
    let pb = fightPower(b, this.year);
    if (resident) {
      // 守るものがある側は粘る。プレイヤーが「守る」を選んでいればさらに。
      pb *= 1.45;
      if (b.id === pid && this.playerStance.kind === 'guard') pb *= 1.15;
    }
    const pWinA = 1 / (1 + Math.exp(-4 * Math.log(pa / pb)));
    const aWins = this.rng.chance(pWinA);
    const [w, l] = aWins ? [a, b] : [b, a];
    w.condition = Math.max(0, w.condition - 0.025);
    l.condition = Math.max(0, l.condition - 0.035);
    w.injury = Math.min(1, w.injury + this.rng.range(0, 0.06));
    l.injury = Math.min(1, l.injury + this.rng.range(0.05, 0.18));
    this.resolveWin(w, l, 'fight', slot);
    // ハーレムの中での喧嘩は子を踏み潰す
    if (slot !== null) {
      this.slotHarass[slot] += 1;
      for (const f of this.slotFemales(slot)) {
        const pup = this.get(f.pupId);
        if (f.id === this.escortedId()) continue; // 主が寄り添っている母子は守られる
        if (pup && pup.alive && this.rng.chance(0.03)) {
          this.kill(pup, 'crushed');
          f.pupId = null;
          this.dayEvents.push({ kind: 'crushed', pupId: pup.id, motherId: f.id });
          this.think(f, 'fPupLost', {});
          if (pup.dynasty > 0) this.pushLog(`${f.name}の子${pup.name}が、喧嘩に巻き込まれて潰された。`, 'dynasty', pup.id);
        }
      }
    }
  }

  /** 挑んだ側が、にらみ合いで取っ組み合いを避けて身を引く */
  private withdraw(me: Individual, opp: Individual, slot: number | null): void {
    const e = 1 / (1 + Math.pow(10, (me.elo - opp.elo) / 400));
    opp.elo += 8 * (1 - e);
    me.elo -= 8 * (1 - e);
    this.dayEvents.push({ kind: 'display', aId: opp.id, bId: me.id, winnerId: opp.id, slot, withdrew: true });
    this.pushLog(`${opp.name}とにらみ合ったが、組み合う前に身を引いた。`, 'player', me.id);
    this.think(me, 'withdrew', { about: opp });
  }

  private resolveWin(w: Individual, l: Individual, kind: 'display' | 'fight', slot: number | null): void {
    l.lastLossDay = this.day;
    const k = kind === 'display' ? 16 : 26;
    const e = 1 / (1 + Math.pow(10, (l.elo - w.elo) / 400));
    w.elo += k * (1 - e);
    l.elo -= k * (1 - e);
    this.dayEvents.push({ kind, aId: w.id, bId: l.id, winnerId: w.id, slot });
    if (kind === 'display') {
      w.season.displaysWon++;
      w.lifetime.displaysWon++;
      l.season.displaysLost++;
      this.think(w, 'winDisplay', { about: l }, 0.5);
      this.think(l, 'loseDisplay', { about: w }, 0.5);
    } else {
      w.season.fightsWon++;
      w.lifetime.fightsWon++;
      l.season.fightsLost++;
      this.think(w, 'winFight', { about: l }, 0.7);
      this.think(l, 'loseFight', { about: w }, 0.7);
    }
    const pid = this.playerId;
    const how = kind === 'display' ? '見せ合い' : '取っ組み合い';
    if (w.id === pid) this.pushLog(`${how}で${l.name}に勝った。`, 'player', w.id);
    if (l.id === pid) this.pushLog(`${how}で${w.name}に負けた。`, 'player', l.id);

    // 主が負けたら枠を明け渡す
    if (slot !== null && this.slotHolders[slot] === l.id) {
      // 別の浜の主が奪ったときは、もとの浜を空ける（主が持てる浜はひとつ）
      const prevSlot = this.slotOf(w);
      if (prevSlot !== null && prevSlot !== slot) this.slotHolders[prevSlot] = null;
      this.slotHolders[slot] = w.id;
      w.slot = slot;
      l.slot = null;
      this.dayEvents.push({ kind: 'takeover', slot, newId: w.id, oldId: l.id });
      this.think(w, 'takeHarem', { about: l });
      this.think(l, 'loseHarem', { about: w });
      for (const f of this.slotFemales(slot)) {
        // 主が替わると愛着は薄れる。懐きやすいメスほど新しい主にも早くなじむ。
        f.loyalty = f.loyalty * 0.25 + 0.2 * f.warmth;
        if (this.rng.chance(0.25)) this.think(f, 'newHolderFemale', { about: w });
      }
      if (w.id === pid) {
        this.pushLog(`${l.name}から浜を奪った！ ハーレムの主になった。`, 'player', w.id);
        this.playerStance = this.defaultStance(this.player!);
      }
      if (l.id === pid) {
        this.pushLog(`${w.name}に浜を奪われた……`, 'player', l.id);
        this.playerStance = { kind: 'roam' };
      }
      if (l.dynasty > 0 && l.id !== pid) this.pushLog(`一族の${l.name}が${w.name}に浜を奪われた。`, 'dynasty', l.id);
      if (w.dynasty > 0 && w.id !== pid) this.pushLog(`一族の${w.name}がハーレムの主になった！`, 'dynasty', w.id);
    } else if (slot !== null) {
      // 防衛成功：ハーレムのメスが見ている
      for (const f of this.slotFemales(slot)) {
        if (this.rng.chance(0.06)) this.think(f, 'fAdmire', { about: w });
        f.loyalty = Math.min(1, f.loyalty + 0.03);
      }
    }
  }

  /** メスの居場所選び。一夫多妻の閾値モデル：魅力が過密の不利益を上回れば、すでに大所帯の主を選ぶ。 */
  private femaleChoose(f: Individual, initial: boolean): void {
    let moveP = f.pupId ? 0.04 : 0.12;
    if (f.slot !== null && f.slot === this.soothedSlot) moveP *= 0.3;
    if (!initial && f.slot !== null && this.slotHolders[f.slot] != null && !this.rng.chance(moveP)) {
      // 主のいる枠にいる限り、たまにしか考え直さない
      f.loyalty = Math.min(1, f.loyalty + 0.01);
      return;
    }
    let best: number | null = null;
    let bestU = -Infinity;
    for (let s = 0; s < this.slotHolders.length; s++) {
      const h = this.get(this.slotHolders[s]);
      if (!h) continue;
      const u = this.slotUtility(f, s, h);
      if (u > bestU) {
        bestU = u;
        best = s;
      }
    }
    if (best === null) {
      if (f.slot !== null) this.invalidateSlots();
      f.slot = null;
      return;
    }
    if (best !== f.slot) {
      const from = f.slot;
      const oldHolder = from !== null ? this.get(this.slotHolders[from]) : undefined;
      const crowded = from !== null && !!oldHolder && this.slotFemales(from).length > this.guardCap(oldHolder);
      const harassed = from !== null && this.slotHarass[from] > 0.8;
      f.slot = best;
      f.loyalty = this.arrivalLoyalty(f, this.get(this.slotHolders[best])!, initial);
      this.invalidateSlots();
      this.dayEvents.push({ kind: 'move', femaleId: f.id, from, to: best });
      if (!initial) {
        const h = this.get(this.slotHolders[best])!;
        if (crowded || harassed) this.think(f, 'fMoveCrowded', {}, 0.6);
        else this.think(f, 'fMoveAttracted', { about: h }, 0.4);
        if (oldHolder && oldHolder.id === this.playerId) this.pushLog(`${f.name}がハーレムを去った。`, 'player', f.id);
        if (h.id === this.playerId) this.pushLog(`${f.name}がハーレムにやってきた。`, 'player', f.id);
      }
    }
  }

  /** メスから見た主の魅力（好みしだいで、ホコの大きさか穏やかさ） */
  private attraction(f: Individual, h: Individual): number {
    const hokoZ = (this.perceivedHoko(f, h) - 40) / 8;
    const gentle = (0.5 - h.base.aggression) * 2;
    return f.base.pref * hokoZ + (1 - f.base.pref) * gentle;
  }

  /**
   * 新しい主のもとに来たメスの最初の愛着。懐きやすさ・主の魅力・去年の馴染みでばらつく。
   * 繁殖期の途中で移ってきたメスは、まだよそよそしい。
   */
  private arrivalLoyalty(f: Individual, h: Individual, initial: boolean): number {
    const familiar = h.id === f.lastHolderId ? 0.3 : 0;
    const base = 0.3 * f.warmth + 0.1 * Math.max(0, this.attraction(f, h)) + familiar + this.rng.normal(0, 0.05);
    return Math.max(0, Math.min(0.8, initial ? base : base * 0.5));
  }

  private slotUtility(f: Individual, s: number, h: Individual): number {
    const n = this.slotFemales(s).filter((x) => x.id !== f.id).length;
    const cap = this.guardCap(h);
    const attract = this.attraction(f, h);
    // 去年身を寄せていた主のもとへは戻りやすい（繁殖場所への執着）
    const familiar = h.id === f.lastHolderId ? 0.35 : 0;
    const crowd = 0.9 * Math.max(0, (n + 1) / cap - 0.85);
    const harass = this.slotHarass[s] * 0.3;
    const company = 0.08 * Math.min(n, 6);
    const stay = f.slot === s ? 0.35 + f.loyalty * 1.2 : 0;
    const sats = Math.min(2, this.satelliteCount[s] ?? 0) * 0.15;
    return attract - crowd - harass + company + stay + sats + familiar + this.rng.normal(0, 0.3);
  }

  /** ハーレムのメスのうち、いま発情しているメスと、これから発情するメスの数 */
  slotEstrus(slot: number): { now: number; later: number } {
    let now = 0;
    let later = 0;
    for (const f of this.slotFemales(slot)) {
      if (f.estrusStart < 0) continue;
      if (this.day >= f.estrusStart && this.day < f.estrusStart + 3) now++;
      else if (this.day < f.estrusStart) later++;
    }
    return { now, later };
  }

  /** 浜全体で、まだ発情を残している（いま発情中か、これから発情する）メスの数 */
  estrusRemaining(): number {
    let n = 0;
    for (const f of this.living()) {
      if (f.sex === 'F' && f.onBeach && f.estrusStart >= 0 && this.day < f.estrusStart + 3) n++;
    }
    return n;
  }

  /** 繁殖期中のメスの状態（主が迫るときの目安） */
  femaleStatus(f: Individual): { estrus: boolean; label: string } {
    const es = f.estrusStart;
    const pup = f.pupId != null && this.get(f.pupId)?.alive ? '・子育て中' : '';
    if (es < 0) return { estrus: false, label: 'まだ若い' };
    if (this.day >= es && this.day < es + 3) return { estrus: true, label: `発情中${pup}` };
    if (this.day < es) {
      const d = es - this.day;
      return { estrus: false, label: `${d <= 2 ? 'もうすぐ発情' : `発情まであと${d}日ほど`}${pup}` };
    }
    const conceived = f.pregnancy && f.pregnancy.conceivedYear === this.year;
    return { estrus: false, label: `${conceived ? '身ごもった' : '発情は終わった'}${pup}` };
  }

  /** プレイヤーが主として、ハーレムのメスに世話をさせる */
  private playerOrderedGrooming(): void {
    const p = this.player;
    const st = this.playerStance;
    if (!p || st.kind !== 'groom') return;
    const s = this.slotOf(p);
    const f = this.get(st.femaleId);
    const what = GROOM_ACT[st.type];
    if (s === null || !f || !f.alive || !f.onBeach || f.slot !== s) {
      this.pushLog(`${f?.name ?? 'そのメス'}はもうハーレムにいない。`, 'player', p.id);
      return;
    }
    const pAccept = Math.min(0.97, 0.35 + 0.65 * f.loyalty + (f.base.boldness < 0.4 ? 0.1 : 0));
    if (this.rng.chance(pAccept)) {
      // 頼まれての世話は、ふだんの気まぐれな世話より念入り
      if (st.type === 'wound') p.injury = Math.max(0, p.injury - 0.1);
      else if (st.type === 'hoko') p.shine = Math.min(0.15, p.shine + 0.05);
      else p.condition = Math.min(1, p.condition + 0.005);
      f.loyalty = Math.min(1, f.loyalty + 0.03);
      p.season.groomed++;
      this.dayEvents.push({ kind: 'groom', femaleId: f.id, maleId: p.id, type: st.type });
      this.pushLog(`${f.name}に${what}させた。`, 'player', f.id);
      this.think(p, st.type === 'hoko' ? 'groomedHoko' : st.type === 'wound' ? 'groomedWound' : 'groomedFur', { about: f });
      this.think(f, 'fOrderedOk', { about: p }, 0.7);
      return;
    }
    f.loyalty = Math.max(0, f.loyalty - 0.1);
    this.pushLog(`${f.name}に${what}させようとしたが、そっぽを向かれた。`, 'player', f.id);
    this.think(f, 'fOrderedNo', { about: p });
    this.think(p, 'orderRefused', { about: f }, 0.7);
    // 愛想を尽かしたメスは浜を出ていく
    if (f.loyalty < 0.1 && this.rng.chance(0.35)) {
      const others = this.slotHolders.map((_, i) => i).filter((i) => i !== s && this.slotHolders[i] != null);
      if (others.length) {
        const to = this.rng.pick(others);
        f.slot = to;
        f.loyalty = 0;
        this.invalidateSlots();
        this.dayEvents.push({ kind: 'move', femaleId: f.id, from: s, to });
        this.pushLog(`${f.name}は愛想を尽かして、${this.get(this.slotHolders[to])!.name}の浜へ去った。`, 'player', f.id);
      }
    }
  }

  /** プレイヤーが主で、その日に寄り添っているメス */
  private escortedId(): number | null {
    const st = this.playerStance;
    const p = this.player;
    if (st.kind !== 'escort' || !p) return null;
    const s = this.slotOf(p);
    const f = this.get(st.femaleId);
    return s !== null && f && f.alive && f.slot === s ? f.id : null;
  }

  /** 主がハーレムのメスを毛づくろいしてやる。愛着が大きく上がる。 */
  private playerTend(): void {
    const p = this.player;
    const st = this.playerStance;
    if (!p || st.kind !== 'tend') return;
    const s = this.slotOf(p);
    const f = this.get(st.femaleId);
    if (s === null || !f || !f.alive || f.slot !== s) {
      this.pushLog(`${f?.name ?? 'そのメス'}はもうハーレムにいない。`, 'player', p.id);
      return;
    }
    f.loyalty = Math.min(1, f.loyalty + 0.15);
    f.condition = Math.min(1, f.condition + 0.01);
    p.condition = Math.max(0, p.condition - 0.003);
    this.dayEvents.push({ kind: 'tend', maleId: p.id, femaleId: f.id });
    this.pushLog(`${f.name}の背中を毛づくろいしてやった。`, 'player', f.id);
    this.think(f, 'fTended', { about: p });
    this.think(p, 'tendDone', { about: f }, 0.6);
  }

  /** 主が低い声で鳴いて、ハーレム全体を落ち着かせる */
  private playerSoothe(): void {
    const p = this.player;
    if (!p || this.playerStance.kind !== 'soothe') return;
    const s = this.slotOf(p);
    if (s === null) return;
    this.soothedSlot = s;
    this.slotHarass[s] *= 0.2;
    p.condition = Math.max(0, p.condition - 0.004);
    const fs = this.slotFemales(s);
    for (const f of fs) {
      f.loyalty = Math.min(1, f.loyalty + 0.03);
      this.think(f, 'fSoothed', { about: p }, 0.15);
    }
    this.dayEvents.push({ kind: 'soothe', maleId: p.id, slot: s });
    this.pushLog(`低い声で鳴いて、ハーレムの${fs.length}頭を落ち着かせた。`, 'player', p.id);
    this.think(p, 'sootheDone', {}, 0.5);
  }

  /** プレイヤーが主として、ハーレムのメスに自分から迫る。つがえたメスの ID を返す。 */
  private playerCourt(): number | null {
    const p = this.player;
    const st = this.playerStance;
    if (!p || st.kind !== 'court') return null;
    const s = this.slotOf(p);
    const f = this.get(st.femaleId);
    if (s === null || !f || !f.alive || !f.onBeach || f.slot !== s) {
      this.pushLog(`${f?.name ?? 'そのメス'}はもうハーレムにいない。`, 'player', p.id);
      return null;
    }
    // 見せ合いだけなら構わないが、取っ組み合いのあとではそれどころではない
    const brawled = this.dayEvents.some((e) => e.kind === 'fight' && (e.aId === p.id || e.bId === p.id));
    if (brawled) {
      this.pushLog(`取っ組み合いのあとで、${f.name}に構うどころではなかった。`, 'player', p.id);
      return null;
    }
    if (!this.femaleStatus(f).estrus) {
      f.loyalty = Math.max(0, f.loyalty - 0.04);
      this.pushLog(`${f.name}に迫ったが、まだその時期ではないと突っぱねられた。`, 'player', f.id);
      this.think(f, 'fCourtNotYet', { about: p });
      this.think(p, 'courtRefused', { about: f }, 0.7);
      return null;
    }
    if (p.sperm < 1) {
      this.pushLog('精が尽きていて、つがえなかった。', 'player', p.id);
      return null;
    }
    if (!this.rng.chance(0.75 + 0.25 * f.loyalty)) {
      this.pushLog(`${f.name}に迫ったが、今日は気が乗らないらしい。`, 'player', f.id);
      this.think(p, 'courtRefused', { about: f }, 0.7);
      return null;
    }
    this.think(f, 'fCourtAccept', { about: p }, 0.6);
    this.mate(p, f, 'holder');
    return f.id;
  }

  private groomingPhase(): void {
    this.playerOrderedGrooming();
    this.playerTend();
    const esc = this.get(this.escortedId());
    if (esc && this.player) {
      esc.loyalty = Math.min(1, esc.loyalty + 0.06);
      this.dayEvents.push({ kind: 'tend', maleId: this.player.id, femaleId: esc.id });
      this.pushLog(`一日じゅう${esc.name}${esc.pupId ? 'と子' : ''}に寄り添って守った。`, 'player', esc.id);
      this.think(esc, 'fEscorted', { about: this.player }, 0.6);
    }
    for (let s = 0; s < this.slotHolders.length; s++) {
      const h = this.get(this.slotHolders[s]);
      if (!h) continue;
      let done = 0;
      for (const f of this.slotFemales(s)) {
        if (done >= 3) break;
        if (!this.rng.chance(0.14 + f.loyalty * 0.25)) continue;
        done++;
        let type: 'hoko' | 'wound' | 'fur';
        if (h.injury > 0.12 && this.rng.chance(0.6)) type = 'wound';
        else type = this.rng.chance(0.45) ? 'hoko' : 'fur';
        if (type === 'wound') h.injury = Math.max(0, h.injury - 0.05);
        else if (type === 'hoko') h.shine = Math.min(0.12, h.shine + 0.025);
        else h.condition = Math.min(1, h.condition + 0.002);
        f.loyalty = Math.min(1, f.loyalty + 0.06);
        h.season.groomed++;
        this.dayEvents.push({ kind: 'groom', femaleId: f.id, maleId: h.id, type });
        const hk: ThoughtKey = type === 'hoko' ? 'groomedHoko' : type === 'wound' ? 'groomedWound' : 'groomedFur';
        const fk: ThoughtKey = type === 'hoko' ? 'fGroomHoko' : type === 'wound' ? 'fGroomWound' : 'fGroomFur';
        this.think(h, hk, { about: f }, h.id === this.playerId ? 0.5 : 0.15);
        this.think(f, fk, { about: h }, 0.12);
      }
    }
    this.groupLickThoughts();
    this.hokoCareFlavor();
  }

  /** メスがホコに海水をかけたり、カニやカモメを追い払ったりする（フレーバー） */
  private hokoCareFlavor(): void {
    for (let s = 0; s < this.slotHolders.length; s++) {
      const h = this.get(this.slotHolders[s]);
      const fs = this.slotFemales(s);
      if (!h || fs.length === 0) continue;
      const r = this.rng.next();
      const what: HokoCare | null = r < 0.08 ? 'splash' : r < 0.13 ? 'crab' : r < 0.16 ? 'gull' : null;
      if (!what) continue;
      // 懐いているメスほど気にかける
      const warm = fs.filter((f) => f.loyalty > 0.3);
      const f = this.rng.pick(warm.length > 0 ? warm : fs);
      this.dayEvents.push({ kind: 'hokoCare', maleId: h.id, femaleId: f.id, what });
      const fk: ThoughtKey = what === 'splash' ? 'fSplashHoko' : what === 'crab' ? 'fShooCrab' : 'fShooGull';
      const mk: ThoughtKey = what === 'splash' ? 'splashedHoko' : what === 'crab' ? 'crabShooed' : 'gullShooed';
      this.think(f, fk, { about: h }, 0.5);
      this.think(h, mk, { about: f }, h.id === this.playerId ? 0.6 : 0.15);
      if (h.id === this.playerId) this.pushLog(`${f.name}${HOKO_CARE[what]}。`, 'player', f.id);
    }
  }

  /** 同じ日に何頭かがホコをなめたら、ときどきそれ専用のセリフにする */
  private groupLickThoughts(): void {
    const lickers = new Map<number, Set<number>>();
    for (const e of this.dayEvents) {
      if (e.kind !== 'groom' || e.type !== 'hoko') continue;
      lickers.set(e.maleId, (lickers.get(e.maleId) ?? new Set()).add(e.femaleId));
    }
    for (const [mid, ids] of lickers) {
      const m = this.get(mid);
      const fs = [...ids].map((id) => this.get(id)).filter((f): f is Individual => !!f && f.alive);
      if (!m || fs.length < 2) continue;
      const names = fs.length <= 3 ? fs.map((f) => f.name).join('と') : `${fs[0].name}と${fs[1].name}たち`;
      this.think(m, 'groomedHokoGroup', { other: names, n: fs.length }, m.id === this.playerId ? 0.4 : 0.2);
      this.think(this.rng.pick(fs), 'fGroomHokoGroup', { about: m, n: fs.length }, 0.3);
    }
  }

  private matingPhase(): void {
    const estrous = this.rng.shuffle(
      this.living().filter((f) => f.sex === 'F' && f.onBeach && f.estrusStart >= 0 && this.day >= f.estrusStart && this.day < f.estrusStart + 3),
    );
    const roamers = this.living().filter(
      (m) =>
        m.onBeach &&
        m.sex === 'M' &&
        m.base.tactic === 'R' &&
        this.age(m) >= 4 &&
        this.slotOf(m) === null &&
        m.condition > 0.12 &&
        !(m.id === this.playerId && this.playerStance.kind === 'rest'),
    );
    const satsBySlot = this.tacticBySlot('S');
    const sneakersBySlot = this.tacticBySlot('F');
    const courted = this.playerCourt();
    // プレイヤーが一頭にかまけている日は、ほかのメスに手が回りにくい
    const busyCourting = this.playerStance.kind === 'court';
    const escorted = this.escortedId();
    for (const f of estrous) {
      if (this.day === f.estrusStart) this.think(f, 'fEstrus', {}, 0.25);
      const s = f.slot;
      const h = s !== null ? this.get(this.slotHolders[s]) : undefined;
      let guarded = false;
      if (h && s !== null) {
        const idx = this.slotFemales(s).findIndex((x) => x.id === f.id);
        guarded = idx >= 0 && idx < this.guardCap(h);
      }
      // 主が寄り添っているメスには、ほかのオスは手を出せない
      const isEscorted = f.id === escorted;
      if (isEscorted) guarded = true;
      let matings = 0;

      if (h && guarded) {
        const pHolder = isEscorted ? 0.9 : h.id === this.playerId && busyCourting ? 0.35 : 0.65;
        if (f.id === courted) matings++;
        else if (!h.foughtToday && h.sperm > 1 && this.rng.chance(pHolder)) {
          this.mate(h, f, 'holder');
          matings++;
        }
        // 衛星型：主が喧嘩している隙に。主が手一杯なときにも、ときどき許される。
        const sats = isEscorted ? [] : satsBySlot.get(s!) ?? [];
        for (const sat of sats) {
          if (matings >= 2) break;
          const p = h.foughtToday ? 0.5 : 0.1;
          if (this.rng.chance(p)) {
            this.mate(sat, f, 'satellite');
            matings++;
          }
        }
      } else if (roamers.length > 0 && this.rng.chance(0.4)) {
        // 見張りの外：周辺のオスが寄ってくる
        const m = this.rng.weighted(roamers, (r) => Math.max(1, r.elo - 700) * (r.id === this.playerId ? 2 : 1))!;
        const protest = this.rng.chance(0.25 + 0.4 * f.base.pref);
        if (protest && h && !h.foughtToday && this.rng.chance(0.5)) {
          this.think(f, 'fProtest', { about: m }, 0.5);
          this.chase(h, m, s);
        } else {
          this.mate(m, f, 'peripheral');
          matings++;
        }
      }

      // 忍び型：メスのふりをして紛れ込む
      if (s !== null) {
        const sneakers = sneakersBySlot.get(s) ?? [];
        for (const sn of sneakers) {
          if (matings >= 2) break;
          if (!this.rng.chance(0.13)) continue;
          // 紛れ込んだ忍びが多いほど、主は疑い深くなる（頻度依存）
          const detect = isEscorted ? 1 : h ? Math.min(0.9, (0.3 + 0.15 * (sneakers.length - 1)) * (h.foughtToday ? 0.3 : 1)) : 0;
          if (h && this.rng.chance(detect)) {
            this.chase(h, sn, s);
            sn.slot = sn.id === this.playerId ? sn.slot : this.pickSlotWeighted();
          } else {
            this.mate(sn, f, 'sneaker');
            matings++;
          }
        }
      }
    }
  }

  private tacticBySlot(t: 'S' | 'F'): Map<number, Individual[]> {
    const out = new Map<number, Individual[]>();
    for (const m of this.inds.values()) {
      if (!m.alive || !m.onBeach || m.sex !== 'M' || m.base.tactic !== t || m.slot === null || this.age(m) < 4) continue;
      if (m.id === this.playerId && this.playerStance.kind === 'rest') continue;
      let list = out.get(m.slot);
      if (!list) out.set(m.slot, (list = []));
      list.push(m);
    }
    return out;
  }

  private chase(h: Individual, intruder: Individual, slot: number | null): void {
    intruder.injury = Math.min(1, intruder.injury + 0.05);
    if (slot !== null) this.slotHarass[slot] += 0.3;
    this.dayEvents.push({ kind: 'chase', holderId: h.id, intruderId: intruder.id });
    this.think(intruder, 'sneakCaught', { about: h }, 0.6);
    if (intruder.id === this.playerId) this.pushLog(`${h.name}に見つかって追い払われた。`, 'player', intruder.id);
    if (h.id === this.playerId) this.pushLog(`ハーレムに忍び寄った${intruder.name}を追い払った。`, 'player', h.id);
  }

  private mate(m: Individual, f: Individual, how: 'holder' | 'satellite' | 'sneaker' | 'peripheral'): void {
    const amount = m.sperm * SPERM.ejaculateFrac;
    m.sperm -= amount;
    f.spermStore.push({ maleId: m.id, amount, day: this.day });
    m.season.matings++;
    m.lifetime.matings++;
    this.dayEvents.push({ kind: 'mate', maleId: m.id, femaleId: f.id, how });
    const n = m.season.matings;
    if (how === 'sneaker') this.think(m, 'sneakSuccess', {}, 0.6);
    else if (how === 'satellite') this.think(m, 'satelliteSuccess', {}, 0.6);
    else if (n >= 3 && n % 2 === 1) this.think(m, 'matedMany', { n }, 0.6);
    else this.think(m, 'mated', { about: f }, 0.5);
    // プレイヤーとつがったメスは、たいてい何かひと言いう
    this.think(f, 'fMated', { about: m }, m.id === this.playerId ? 0.7 : 0.1);
    if (m.id === this.playerId) this.pushLog(`${f.name}とつがった。（今季${n}回目・射精${amount.toFixed(0)}億）`, 'player', m.id);
  }

  /** 発情の終わりに受精を判定する。精子の「くじ引き」：生き残った精子の数に比例して父が決まる。 */
  private resolveConception(f: Individual): void {
    const store = f.spermStore;
    f.spermStore = [];
    if (store.length === 0) return;
    const viable = store.map((d) => ({ maleId: d.maleId, v: d.amount * Math.pow(SPERM.survivalPerDay, this.day - d.day) }));
    const total = viable.reduce((s, d) => s + d.v, 0);
    const age = this.age(f);
    const fertility = (0.55 + 0.45 * f.condition) * f.base.vigor * (age > 14 ? 0.6 : 1);
    const pConceive = (1 - Math.exp(-total / SPERM.fertilizationScale)) * Math.min(1, fertility * 1.05);
    if (!this.rng.chance(pConceive)) return;
    const pick = this.rng.weighted(viable, (d) => d.v)!;
    const father = this.inds.get(pick.maleId)!;
    const embryo = fertilize(makeGamete(f.genome, this.rng), makeGamete(father.genome, this.rng));
    // 逆位ホモ接合は胚致死、有害劣性のホモ接合は流産しやすい
    if (tacticOf(embryo) === null) return;
    if (!this.rng.chance(Math.pow(vigorOf(embryo), 1.5))) return;
    f.pregnancy = { fatherId: father.id, genome: embryo, conceivedYear: this.year };
    this.conceptionsThisYear++;
    if (father.id === this.playerId) this.playerConceptions++;
  }

  private giveBirth(f: Individual): void {
    const preg = f.pregnancy!;
    f.pregnancy = null;
    const father = this.inds.get(preg.fatherId);
    const pup = this.addIndividual(preg.genome, f, preg.fatherId, this.year);
    pup.condition = 0.4 + 0.4 * f.condition;
    pup.onBeach = true;
    pup.slot = f.slot;
    pup.dynasty = (f.dynasty + (father?.dynasty ?? 0)) / 2;
    f.pupId = pup.id;
    f.childIds.push(pup.id);
    father?.childIds.push(pup.id);
    this.birthsThisYear++;
    if (father) this.paternity[father.base.tactic]++;
    this.dayEvents.push({ kind: 'birth', motherId: f.id, pupId: pup.id });
    this.think(f, 'fGaveBirth', { about: pup }, 0.5);
    // 子の素質（オスはホコの素質、メスは息子に伝わる遺伝的な値）
    const potential = pup.sex === 'M' ? pup.base.hoko : geneticHoko(pup);
    const stars = potentialStars(potential, this.herdHokoMean());
    const label = `${pup.sex === 'M' ? `オス・${tacticLabel(pup.base.tactic)}` : 'メス'}・素質${starText(stars)}`;
    if (father && father.id === this.playerId) {
      this.pushLog(`${f.name}があなたの子「${pup.name}」（${label}）を産んだ。`, 'player', pup.id);
    } else if (pup.dynasty > 0) {
      this.pushLog(`一族の子「${pup.name}」（${label}）が生まれた。`, 'dynasty', pup.id);
    }
    if (pup.dynasty > 0 && pup.sex === 'M' && pup.base.tactic === 'R') {
      if (stars >= 5) this.think(f, 'fBigPup', { about: pup });
      if (this.bestHoko && pup.base.hoko > this.bestHoko.value) {
        this.bestHoko = { id: pup.id, name: pup.name, value: pup.base.hoko, year: this.year };
        this.pushLog(`一族最高の素質！「${pup.name}」は育てばホコ${pup.base.hoko.toFixed(1)}cmになる。`, 'dynasty', pup.id);
      }
    }
  }

  /** 子どもたち：メスの子は母のまねをして世話を手伝い、オスの子や若いオスは主をうらやむ */
  private youngReactions(): void {
    const busy = new Set<number>();
    for (const e of this.dayEvents) {
      if (e.kind !== 'groom') continue;
      const mother = this.get(e.femaleId);
      const pup = mother?.pupId != null ? this.get(mother.pupId) : undefined;
      const h = this.get(e.maleId);
      if (!mother || !pup || !h || !pup.alive || busy.has(pup.id)) continue;
      // ホコの手入れには子は加わらず、そばで待っている
      if (e.type === 'hoko') {
        if (this.rng.chance(0.25)) {
          busy.add(pup.id);
          this.think(pup, 'pupWaitMom', { about: h });
        }
        continue;
      }
      if (pup.sex !== 'F' || !this.rng.chance(0.3)) continue;
      busy.add(pup.id);
      this.think(pup, 'pupHelpGroom', { about: h });
      if (h.id === this.playerId) this.pushLog(`${pup.name}も母の${mother.name}のまねをして、${GROOM_ACT[e.type]}手伝った。`, 'player', pup.id);
    }
    // 母がつがっているあいだ、子は離れたところで待つ
    for (const e of this.dayEvents) {
      if (e.kind !== 'mate') continue;
      const mother = this.get(e.femaleId);
      const pup = mother?.pupId != null ? this.get(mother.pupId) : undefined;
      if (!pup || !pup.alive || busy.has(pup.id) || !this.rng.chance(0.25)) continue;
      busy.add(pup.id);
      this.think(pup, 'pupWaitMate', {});
    }
    // 浜の主（たいていは父）が勝つのを見た子は、憧れる
    for (const e of this.dayEvents) {
      if ((e.kind !== 'display' && e.kind !== 'fight') || e.slot === null || this.slotHolders[e.slot] !== e.winnerId) continue;
      const hero = this.get(e.winnerId);
      if (!hero) continue;
      for (const f of this.slotFemales(e.slot)) {
        const pup = f.pupId != null ? this.get(f.pupId) : undefined;
        if (!pup || !pup.alive || busy.has(pup.id) || !this.rng.chance(0.2)) continue;
        busy.add(pup.id);
        const dad = pup.fatherId === hero.id;
        this.think(pup, 'pupCheer', { about: hero, other: dad ? 'お父さん' : hero.name });
      }
    }
    // 交尾したか世話をされた主
    const envied = new Set<number>();
    for (const e of this.dayEvents) if ((e.kind === 'mate' && e.how === 'holder') || e.kind === 'groom') envied.add(e.maleId);
    if (envied.size === 0) return;
    for (const ind of this.living()) {
      if (ind.sex !== 'M' || !ind.onBeach || busy.has(ind.id)) continue;
      const age = this.age(ind);
      if (age >= 5) continue;
      // 子は母のいる浜の主を、若いオスはどこかの主を見ている
      let h: Individual | undefined;
      if (age === 0) {
        const mother = ind.motherId != null ? this.get(ind.motherId) : undefined;
        const holder = mother && mother.slot !== null ? this.get(this.slotHolders[mother.slot]) : undefined;
        if (holder && envied.has(holder.id) && this.rng.chance(0.12)) h = holder;
      } else if (this.rng.chance(0.04)) {
        h = this.get(this.rng.pick([...envied]));
      }
      if (!h || h.id === ind.id) continue;
      this.think(ind, 'youngEnvy', { about: h });
    }
  }

  private ambientThoughts(): void {
    for (const ind of this.living()) {
      if (!ind.onBeach || !this.rng.chance(ind.id === this.playerId ? 0.12 : 0.03)) continue;
      // その日に出来事のつぶやきがあれば、それを上書きしない
      if (ind.thought && ind.thought.year === this.year && ind.thought.day === this.day) continue;
      const age = this.age(ind);
      let key: ThoughtKey;
      if (age === 0) key = this.rng.chance(0.5) ? 'pupMilk' : 'pupIdle';
      else if (ind.sex === 'M' && age < 5) key = 'youngWatch';
      else if (ind.sex === 'M') {
        const s = this.slotOf(ind);
        if (s !== null) key = ind.condition < 0.3 ? 'holderFasting' : 'holderIdle';
        else key = 'peripheralIdle';
      } else key = 'fIdle';
      // メスは自分のいる浜の主を思い浮かべる
      const about = ind.sex === 'F' && ind.slot !== null ? this.get(this.slotHolders[ind.slot]) : undefined;
      this.think(ind, key, { about }, 1);
    }
  }

  endBreedingSeason(): SeasonSummary {
    const p = this.player;
    for (const ind of this.living()) {
      if (ind.sex === 'F' && ind.spermStore.length > 0) this.resolveConception(ind);
      if (ind.sex === 'M' && this.age(ind) >= 5) {
        const n = ind.season.matings;
        if (n >= 4) this.think(ind, 'seasonHappy', { n }, 1);
        else if (n >= 1) this.think(ind, 'seasonSome', { n }, 1);
        else this.think(ind, 'seasonZero', {}, 1);
        if (this.slotOf(ind) !== null) ind.lifetime.holderSeasons++;
      }
    }
    this.recordStats();
    const head = this.heads[this.heads.length - 1];
    if (head && p && head.id === p.id) head.peakHarem = Math.max(head.peakHarem, p.season.peakHarem);
    const summary: SeasonSummary = {
      year: this.year,
      playerMatings: p?.season.matings ?? 0,
      playerWasHolder: p ? p.season.peakHarem > 0 : false,
      playerPeakHarem: p?.season.peakHarem ?? 0,
      playerDisplays: [p?.season.displaysWon ?? 0, p?.season.displaysLost ?? 0],
      playerFights: [p?.season.fightsWon ?? 0, p?.season.fightsLost ?? 0],
      conceptions: this.conceptionsThisYear,
      playerConceptions: this.playerConceptions,
    };
    for (const ind of this.living()) {
      if (ind.sex === 'F') ind.lastHolderId = ind.slot !== null ? this.slotHolders[ind.slot] ?? null : null;
      ind.onBeach = false;
      ind.slot = this.slotOf(ind);
      ind.pupId = null;
    }
    this.invalidateSlots();
    this.phase = 'foraging';
    return summary;
  }

  // ───────────────────────── 採餌期（年の変わり目） ─────────────────────────

  private foodNow(): number {
    const density = this.living().length / CARRYING;
    return Math.min(0.7, Math.max(0.1, 0.62 * (1.5 - 0.85 * density)));
  }

  /** 採餌期の収支：食べて得る分と、体の維持費（ホコと精巣は高くつく組織） */
  private forageBudget(ind: Individual, food: number, effort: number): { gain: number; upkeep: number } {
    const age = this.age(ind);
    let upkeep = 0.12;
    if (ind.sex === 'M') {
      upkeep += 0.07 * Math.pow(ind.base.hoko / 40, 2) * (age >= 4 ? 1 : 0.3);
      upkeep += 0.05 * (testisMass(ind, this.year) / 350);
    } else if (ind.pregnancy) upkeep += 0.08;
    // 大きな体ほど一度に多く食べられる
    const intake = ind.sex === 'M' && age >= 4 ? 1.3 : 1;
    // 繁殖期に絶食して痩せたオスほど、冬に必死に食べて取り戻す（代償的な採餌）
    const hunger = ind.sex === 'M' && age >= 5 ? 1 + 0.6 * (1 - ind.condition) : 1;
    return { gain: food * effort * intake * hunger * (0.7 + 0.3 * ind.base.vigor), upkeep };
  }

  /** シャチに襲われる確率。大きなホコほど泳ぎが遅く、狙われやすい。 */
  private orcaRisk(ind: Individual, orcaMul: number, condition = ind.condition): number {
    const hokoRisk = ind.sex === 'M' && this.age(ind) >= 4 ? Math.pow(ind.base.hoko / 40, 3) : 1;
    return 0.016 * orcaMul * hokoRisk * (1.2 - 0.5 * condition);
  }

  /** プレイヤーが採餌の方針を選ぶための見込み（体力の増減と、シャチに襲われる確率） */
  forageOutlook(strat: ForageStrategy): { delta: number; lo: number; hi: number; orca: number } {
    const p = this.player;
    if (!p) return { delta: 0, lo: 0, hi: 0, orca: 0 };
    const { effort, orcaMul } = FORAGE[strat];
    const { gain, upkeep } = this.forageBudget(p, this.foodNow(), effort);
    // 餌の当たり外れで、食べられる量は ±15% ぶれる
    const after = (k: number) => Math.min(1, Math.max(0, p.condition + gain * k - upkeep));
    return { delta: after(1) - p.condition, lo: after(0.85) - p.condition, hi: after(1.15) - p.condition, orca: this.orcaRisk(p, orcaMul, after(1)) };
  }

  forage(playerStrategy: ForageStrategy = 'normal'): ForageReport {
    const living = this.living();
    const food = this.foodNow();
    const deaths: ForageReport['deaths'] = [];
    const p = this.player;
    const playerCondBefore = p?.condition ?? 0;

    for (const ind of living) {
      const age = this.age(ind);
      const strat: ForageStrategy = ind.id === this.playerId ? playerStrategy : ind.base.boldness > 0.62 ? 'greedy' : ind.base.boldness < 0.38 ? 'cautious' : 'normal';
      const { effort, orcaMul } = FORAGE[strat];
      const { gain: meanGain, upkeep } = this.forageBudget(ind, food, effort);
      const gain = meanGain * this.rng.range(0.85, 1.15);
      ind.condition = Math.min(1, Math.max(0, ind.condition + gain - upkeep));

      // 死亡
      let pDie = 0;
      let cause: DeathCause = 'old';
      const add = (q: number, c: DeathCause) => {
        if (q > 0 && this.rng.chance(q)) {
          pDie = 1;
          cause = c;
        }
      };
      if (age === 0) add(0.16 + 0.4 * (1 - ind.condition), 'weak');
      else if (age <= 2) add(0.07, 'sick');
      else add(ind.sex === 'M' ? 0.06 : 0.045, 'sick');
      if (age > 11) add(0.07 * (age - 11), 'old');
      const pOrca = this.orcaRisk(ind, orcaMul);
      if (pDie === 0) add(pOrca, 'orca');
      if (pDie === 0 && ind.condition < 0.08) add(0.6, 'starve');
      else if (pDie === 0 && ind.condition < 0.16) add(0.2, 'starve');
      if (pDie === 0) add(ind.injury * ind.injury * 0.6, 'wound');
      if (pDie === 0) add((1 - ind.base.vigor) * 0.25, 'sick');
      if (pDie > 0) {
        this.kill(ind, cause);
        deaths.push({ id: ind.id, name: ind.name, cause, dynasty: ind.dynasty, age });
        // 母が死ねば、乳離れ前の子も生きられない（採餌期の初めに離乳するので、ここでは妊娠のみ失われる）
        if (ind.pregnancy) ind.pregnancy = null;
        continue;
      }
      if (pOrca > 0.04 && this.rng.chance(0.3)) this.think(ind, 'orcaEscape', {}, 1);
      ind.injury *= 0.25;
      ind.shine = 0;
      ind.elo = 1000 + (ind.elo - 1000) * 0.75;
    }

    if (p && p.alive) {
      if (p.condition - playerCondBefore > 0.25) this.think(p, 'fat', {}, 1);
      else if (p.condition < 0.35) this.think(p, 'thin', {}, 1);
    }

    const playerDied = !!p && !p.alive;
    if (playerDied) this.pushLog(`${p!.name}は${causeLabel(p!.deathCause!)}で世を去った。享年${this.age(p!)}。`, 'player', p!.id);
    for (const d of deaths) {
      if (d.dynasty > 0 && d.id !== this.playerId && d.age > 0) this.pushLog(`一族の${d.name}が${causeLabel(d.cause)}で死んだ。`, 'dynasty', d.id);
    }
    // よその浜からの移入（遺伝子流動）
    const immigrants = this.rng.poisson(1.6);
    for (let k = 0; k < immigrants; k++) {
      const sex = this.rng.chance(0.6) ? 'M' : 'F';
      let genome: Genome;
      do genome = randomGenome(sex, this.rng);
      while (tacticOf(genome) === null);
      const ind = this.addIndividual(genome, null, null, this.year - this.rng.int(3, 5));
      ind.condition = this.rng.range(0.45, 0.7);
      ind.immigrant = true;
      if (this.playerId !== null && this.rng.chance(0.5)) this.pushLog(`よその浜から${ind.name}（${sex === 'M' ? 'オス' : 'メス'}）が流れ着いた。`, 'event', ind.id);
    }
    // 主が死んだ枠は空ける
    for (let s = 0; s < this.slotHolders.length; s++) {
      const h = this.get(this.slotHolders[s]);
      if (h && !h.alive) this.slotHolders[s] = null;
    }
    if (playerDied) this.closeHead();
    const milestones = this.founderId !== null ? this.checkMilestones() : [];
    this.year++;
    // 次の繁殖期が始まるまでの出来事（跡継ぎ選びなど）は「春」として記録する
    this.day = -1;
    return {
      milestones,
      deaths,
      playerDied,
      playerCause: playerDied ? p!.deathCause : null,
      conditionDelta: p ? p.condition - playerCondBefore : 0,
    };
  }

  private kill(ind: Individual, cause: DeathCause): void {
    ind.alive = false;
    ind.deathYear = this.year;
    ind.deathCause = cause;
    ind.onBeach = false;
    const s = this.slotOf(ind);
    if (s !== null) this.slotHolders[s] = null;
    if (ind.sex === 'F') this.invalidateSlots();
  }

  // ───────────────────────── 自動進行（バーンイン・テスト用） ─────────────────────────

  simulateYearAuto(): { summary: SeasonSummary; forage: ForageReport } {
    this.startBreedingSeason();
    for (let d = 0; d < BREED_DAYS; d++) {
      const gen = this.runDay();
      let r = gen.next();
      while (!r.done) r = gen.next(this.aiAnswer(r.value));
    }
    const summary = this.endBreedingSeason();
    const forage = this.forage();
    return { summary, forage };
  }

  /** プレイヤーの判断を、その個体の気質に任せる */
  aiAnswer(prompt: Prompt): Answer {
    const me = this.player;
    const aggr = me?.base.aggression ?? 0.5;
    const ratio = prompt.perceivedOpp / Math.max(1, prompt.self);
    if (prompt.kind === 'challenged') return ratio > 1.05 + 0.12 * aggr + 0.05 ? 'retreat' : 'accept';
    return ratio > 1.05 + 0.12 * aggr || prompt.oppBody > prompt.selfBody * 1.15 ? 'retreat' : 'accept';
  }

  // ───────────────────────── 記録 ─────────────────────────

  private think(ind: Individual, key: ThoughtKey, ctx: { other?: string; n?: number; about?: Individual }, prob = 1): void {
    if (!ind.alive && key !== 'fPupLost') return;
    const now = this.year * 100 + this.day;
    // ふだんのつぶやき（必ず言うもの以外）は、同じ場面を2日以内にくり返しにくくする
    if (prob < 1 && now - (ind.keyDay[key] ?? -99) <= 2) prob *= 0.35;
    if (prob < 1 && !this.rng.chance(prob)) return;
    ind.keyDay[key] = now;
    const { tags, cm } = this.thoughtTags(ind, ctx.about);
    // 同じ文を、本人は直近 8 回、群れ全体では 2 日のうちに繰り返さない（候補が尽きたときは除く）
    const avoid = (raw: string) => ind.recentLines.includes(raw) || now - (this.saidRecently.get(raw) ?? -99) <= 1;
    ind.thought = makeThought(ind, key, this.rng, { year: this.year, day: this.day, other: ctx.other ?? ctx.about?.name, n: ctx.n, tags, cm, aboutId: ctx.about?.id, avoid });
    const raw = ind.thought.raw!;
    ind.recentLines = [...ind.recentLines.slice(-7), raw];
    // 群れ全体の重なりは、あなたの目に入るセリフ（自分・ハーレム・一族）だけで数える
    if (ind.id === this.playerId || ind.dynasty > 0 || this.isPlayerHaremFemale(ind)) this.saidRecently.set(raw, now);
    if (ind.id === this.playerId) {
      this.pushLog(`「${ind.thought.text}」`, 'thought', ind.id);
    } else if (this.isPlayerHaremFemale(ind) || (ind.dynasty > 0 && this.rng.chance(0.3))) {
      this.pushLog(`${ind.name}「${ind.thought.text}」`, 'thought', ind.id);
    }
  }

  /** セリフを選ぶための札：話題のオスのホコの大きさ、メスの愛着と好み、年齢 */
  private thoughtTags(ind: Individual, about?: Individual): { tags: Tag[]; cm?: number } {
    const tags: Tag[] = [];
    const male = ind.sex === 'M' ? ind : about && about.sex === 'M' && this.age(about) >= 4 ? about : undefined;
    const female = ind.sex === 'F' ? ind : about && about.sex === 'F' ? about : undefined;
    let cm: number | undefined;
    if (male && this.age(male) >= 4) {
      cm = this.hoko(male);
      const mean = this.herdHokoMean();
      if (cm >= mean + 9) tags.push('huge', 'big');
      else if (cm >= mean + 4) tags.push('big');
      else if (cm <= mean - 4) tags.push('small');
    }
    if (female && this.age(female) >= 3) {
      if (female.loyalty > 0.55 && female.slot !== null && this.slotHolders[female.slot] != null) tags.push('fond');
      else if (female.loyalty < 0.15 && female.slot !== null) tags.push('cold');
      if (female.base.pref > 0.62) tags.push('hokoFan');
      else if (female.base.pref < 0.38) tags.push('gentleFan');
    }
    // その年生まれの子は、オスの子かメスの子か
    if (this.age(ind) === 0) tags.push(ind.sex === 'M' ? 'boy' : 'girl');
    if (ind.sex === 'M') {
      const age = this.age(ind);
      if (age >= 12) tags.push('old');
      else if (age <= 6) tags.push('young');
      // 相手のオスとのホコの差
      if (about && about.sex === 'M' && this.age(about) >= 4 && this.age(ind) >= 4) {
        const r = this.perceivedHoko(ind, about) / Math.max(1, this.hoko(ind));
        tags.push(r > 1.12 ? 'rivalBig' : r < 0.89 ? 'rivalSmall' : 'rivalEven');
      }
    }
    return { tags, cm };
  }

  isPlayerHaremFemale(ind: Individual): boolean {
    const p = this.player;
    if (!p || ind.sex !== 'F') return false;
    const s = this.slotOf(p);
    return s !== null && ind.slot === s;
  }

  pushLog(text: string, kind: LogKind, indId?: number): void {
    this.log.push({ year: this.year, day: this.day, text, kind, indId });
    if (this.log.length > 400) this.log.splice(0, this.log.length - 400);
  }

  private recordStats(): void {
    const living = this.living();
    const adultM = living.filter((i) => i.sex === 'M' && this.age(i) >= 6);
    const adultF = living.filter((i) => isAdultFemale(i, this.year));
    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    // 戦略座位の対立遺伝子頻度
    let s = 0;
    let f = 0;
    let n = 0;
    for (const i of living) {
      for (const v of allelesAt(i.genome, 'TACTIC')) {
        n++;
        if (v === 1) s++;
        else if (v === 2) f++;
      }
    }
    const rTactic = adultM.filter((m) => m.base.tactic === 'R');
    const totalPat = this.paternity.R + this.paternity.S + this.paternity.F || 1;
    this.history.push({
      year: this.year,
      population: living.length,
      adultMales: adultM.length,
      adultFemales: adultF.length,
      births: this.birthsThisYear,
      hokoMean: mean(rTactic.map((m) => m.base.hoko)),
      testisMean: mean(rTactic.map((m) => m.base.testis)),
      bodyMean: mean(rTactic.map((m) => m.base.body)),
      prefMean: mean(adultF.map((x) => x.base.pref)),
      freqS: n ? s / n : 0,
      freqF: n ? f / n : 0,
      delLoadMean: mean(living.map((i) => i.base.delLoad)),
      dynastyShare: mean(living.map((i) => i.dynasty)),
      dynastyCount: living.filter((i) => i.dynasty > 0).length,
      dynastyGeneticHoko: living.some((i) => i.dynasty > 0) ? mean(living.filter((i) => i.dynasty > 0).map(geneticHoko)) : NaN,
      herdGeneticHoko: mean(living.map(geneticHoko)),
      paternityByTactic: {
        R: this.paternity.R / totalPat,
        S: this.paternity.S / totalPat,
        F: this.paternity.F / totalPat,
      },
    });
    if (this.history.length > 300) this.history.shift();
  }
}

export interface FounderOption {
  ind: Individual;
  /** big：大物（やさしい）、mid：並（ふつう）、small：小兵（むずかしい）、odd：変わり種 */
  kind: 'big' | 'mid' | 'small' | 'odd';
}

export interface HeadRecord {
  id: number;
  name: string;
  generation: number;
  fromYear: number;
  toYear: number | null;
  cause: DeathCause | null;
  /** 成熟時のホコの素質 */
  potential: number;
  /** 当主になったときの群れの平均 */
  herdMean: number;
  peakHarem: number;
}

/** 自分の欄に出すメスのセリフの優先順（あなたとの関わりが深いものから） */
const FEMALE_LINE_PRIORITY = [
  'fCourtAccept', 'fMated', 'fGroomHokoGroup', 'fGroomHoko', 'fShooCrab', 'fShooGull', 'fSplashHoko', 'fOrderedOk', 'fTended', 'fEscorted', 'fGaveBirth', 'fBigPup',
  'fOrderedNo', 'fCourtNotYet', 'fGroomWound', 'fGroomFur', 'pupHelpGroom', 'fAdmire', 'fSoothed', 'newHolderFemale',
  'fMoveAttracted', 'fPupLost', 'fProtest', 'fEstrus', 'fMoveCrowded', 'pupCheer', 'youngEnvy', 'pupWaitMom', 'pupWaitMate', 'fIdle',
];

/** 血統占有率の節目 */
export const MILESTONES = [0.01, 0.02, 0.05, 0.1, 0.2, 0.3, 0.5];

/** 採餌の方針ごとの、食べる量とシャチに遭う危険の倍率 */
export const FORAGE: Record<ForageStrategy, { effort: number; orcaMul: number }> = {
  cautious: { effort: 0.88, orcaMul: 0.4 },
  normal: { effort: 1, orcaMul: 1 },
  greedy: { effort: 1.15, orcaMul: 2.6 },
};

/** おまかせで選んだ行動の説明 */
function autoLabel(w: World, s: Stance): string {
  const name = (id: number) => w.get(id)?.name ?? '―';
  switch (s.kind) {
    case 'soothe': return '浜が騒がしいので、ハーレムをなだめる';
    case 'escort': return `見張りの外にいる発情中の${name(s.femaleId)}に寄り添う`;
    case 'tend': return `機嫌の悪い${name(s.femaleId)}を毛づくろいしてやる`;
    case 'groom': return `${name(s.femaleId)}に${GROOM_ACT[s.type]}させる`;
    case 'rest': {
      // 理由で文言を分ける（メスが何頭もいるのに「いない」と読めないように）
      const p = w.player;
      const slot = p ? w.slotOf(p) : null;
      const n = slot !== null ? w.slotFemales(slot).length : 0;
      return n === 0 ? 'ハーレムにメスがいないので、海で食べて蓄える' : `痩せてきたうえ、ハーレムの${n}頭はしばらく発情しないので、海で食べて蓄える`;
    }
    default: return '浜を守る';
  }
}

export function causeLabel(c: DeathCause): string {
  switch (c) {
    case 'old': return '老衰';
    case 'orca': return 'シャチの襲撃';
    case 'starve': return '飢え';
    case 'wound': return '傷の悪化';
    case 'sick': return '病気';
    case 'crushed': return '圧死';
    case 'orphan': return '母の死';
    case 'weak': return '衰弱';
  }
}
