import '@fontsource/dotgothic16';
import './style.css';
import { Scene, VIEW_H, VIEW_W } from './render/scene';
import { bodyMass, hokoDisplay, hokoFirmness, tacticLabel, testisMass, type Individual } from './sim/individual';
import {
  BREED_DAYS,
  World,
  causeLabel,
  type Answer,
  type ForageReport,
  type ForageStrategy,
  type GroomType,
  type Stance,
  type FounderOption,
  type LogKind,
  type Prompt,
  type SeasonSummary,
} from './sim/world';
import { bar, btn, clear, h } from './ui/dom';
import { installFrames } from './ui/frame';
import { ask, isModalOpen } from './ui/modal';
import { renderLog, renderSide, type GameView, type Tab } from './ui/panels';
import { portrait } from './ui/portrait';
import { bloodEstimate, potentialStars, starText } from './sim/lineage';

type Mode = 'title' | 'loading' | 'season' | 'between' | 'over';

const $ = (id: string) => document.getElementById(id)!;

class Game implements GameView {
  world: World;
  scene: Scene;
  mode: Mode = 'title';
  playing = false;
  speed = 1;
  autoJudge = false;
  tab: Tab = 'selected';
  selectedId: number | null = null;
  logFilter: LogKind | 'all' = 'all';
  logPinned = true;
  private stepping = false;
  private dayClock = 0;
  private last = performance.now();
  private canvas = $('view') as HTMLCanvasElement;
  private best = { share: 0, year: 0 };

  constructor() {
    installFrames();
    this.world = World.create(Math.floor(Math.random() * 1e9), 15);
    this.world.startBreedingSeason();
    this.scene = new Scene(this.canvas, this.world);
    this.scene.applyDay([], 0);
    this.bindCanvas();
    this.fit();
    window.addEventListener('resize', () => this.fit());
    window.addEventListener('keydown', (e) => this.onKey(e));
    this.showTitle();
    requestAnimationFrame((t) => this.frame(t));
  }

  // ───────────────────────── ループ ─────────────────────────

  private dayMs(): number {
    if (this.mode === 'title') return 1800;
    return 2400 / this.speed;
  }

  private frame(t: number): void {
    const dt = Math.min(100, t - this.last);
    this.last = t;
    this.scene.update(dt);
    this.scene.draw();
    $('pause-hint').classList.toggle('show', this.mode === 'season' && !this.playing && !this.stepping && !isModalOpen());
    const auto = this.mode === 'title' || (this.mode === 'season' && this.playing);
    if (auto && !this.stepping && !isModalOpen()) {
      this.dayClock += dt;
      if (this.dayClock >= this.dayMs()) {
        this.dayClock = 0;
        void this.stepDay();
      }
    }
    requestAnimationFrame((tt) => this.frame(tt));
  }

  async stepDay(): Promise<void> {
    if (this.stepping) return;
    this.stepping = true;
    const w = this.world;
    try {
      if (this.mode === 'title') {
        if (w.day >= BREED_DAYS) {
          w.endBreedingSeason();
          const rep = w.forage();
          this.scene.playOrcaAttacks(rep.deaths.filter((d) => d.cause === 'orca').length);
          w.startBreedingSeason();
        }
        const gen = w.runDay();
        let r = gen.next();
        while (!r.done) r = gen.next(w.aiAnswer(r.value));
        this.scene.applyDay(w.dayEvents, this.dayMs());
        return;
      }
      if (this.mode !== 'season') return;
      const gen = w.runDay();
      let r = gen.next();
      while (!r.done) {
        const ans: Answer = this.autoJudge ? w.aiAnswer(r.value) : await this.askPrompt(r.value);
        r = gen.next(ans);
      }
      this.scene.applyDay(w.dayEvents, this.dayMs());
      this.refresh();
      this.toastResult();
      if (w.day >= BREED_DAYS) {
        this.playing = false;
        await this.endSeason();
      }
    } finally {
      this.stepping = false;
    }
  }

  /** その日のプレイヤーの勝負の結果を浜の上に出す */
  private toastResult(): void {
    const w = this.world;
    const pid = w.playerId;
    const msgs: { text: string; win: boolean }[] = [];
    for (const e of w.dayEvents) {
      if ((e.kind === 'display' || e.kind === 'fight') && (e.aId === pid || e.bId === pid)) {
        const win = e.winnerId === pid;
        const opp = w.get(e.aId === pid ? e.bId : e.aId)?.name ?? '相手';
        const how = e.kind === 'display' ? '見せ合い' : '取っ組み合い';
        if (e.kind === 'display' && e.withdrew) msgs.push({ text: `${opp}とのにらみ合いから身を引いた`, win: false });
        else msgs.push({ text: `${how}で${opp}に${win ? '勝った！' : '負けた……'}`, win });
      }
      if (e.kind === 'takeover' && e.newId === pid) msgs.push({ text: '浜とハーレムを手に入れた！', win: true });
      if (e.kind === 'takeover' && e.oldId === pid) msgs.push({ text: '浜とハーレムを失った……', win: false });
    }
    if (msgs.length === 0) return;
    const p = w.player;
    const el = $('toast');
    el.textContent = msgs.map((m) => m.text).join('　') + (p && p.injury > 0.05 ? `（ケガ ${Math.round(p.injury * 100)}%）` : '');
    el.className = `show ${msgs[msgs.length - 1].win ? 'win' : 'lose'}`;
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (el.className = ''), 3200);
  }

  private toastTimer = 0;

  // ───────────────────────── 季節の切り替え ─────────────────────────

  private async endSeason(): Promise<void> {
    const w = this.world;
    this.mode = 'between';
    const summary = w.endBreedingSeason();
    this.scene.applyDay([], 1500);
    this.refresh();
    const strategy = await this.showSeasonReport(summary);
    const rep = w.forage(strategy);
    this.trackBest();
    this.refresh();
    // 沖でのシャチの襲撃を見せてから報告を出す
    const kills = rep.deaths.filter((d) => d.cause === 'orca').length;
    if (kills > 0) {
      this.scene.playOrcaAttacks(kills);
      await new Promise((r) => setTimeout(r, Math.min(4500, 1800 + kills * 450)));
    }
    await this.showForageReport(rep, strategy);
    if (rep.playerDied) {
      const ok = await this.chooseHeir();
      if (!ok) return;
    }
    this.beginSeason();
  }

  private beginSeason(): void {
    const w = this.world;
    w.startBreedingSeason();
    this.mode = 'season';
    this.scene.applyDay([], 1200);
    this.refresh();
  }

  private trackBest(): void {
    const w = this.world;
    const living = w.living();
    const share = living.reduce((s, i) => s + i.dynasty, 0) / Math.max(1, living.length);
    if (share > this.best.share) this.best = { share, year: w.year };
  }

  /** 若い当主のあいだ、年ごと自動で進める */
  async fastForward(): Promise<void> {
    if (this.mode !== 'season') return;
    const w = this.world;
    this.playing = false;
    this.mode = 'between';
    const p = w.player!;
    while (w.player && w.player.alive && w.age(w.player) < 4) {
      // 今季の残りを自動で
      while (w.day < BREED_DAYS) {
        const gen = w.runDay();
        let r = gen.next();
        while (!r.done) r = gen.next(w.aiAnswer(r.value));
      }
      w.endBreedingSeason();
      const rep = w.forage('normal');
      this.trackBest();
      if (rep.playerDied) {
        await this.showForageReport(rep, 'normal');
        const ok = await this.chooseHeir();
        if (!ok) return;
        break;
      }
      w.startBreedingSeason();
    }
    if (w.phase === 'foraging') w.startBreedingSeason();
    void p;
    this.mode = 'season';
    this.scene.setWorld(w);
    this.scene.applyDay([], 800);
    this.refresh();
  }

  // ───────────────────────── 操作 ─────────────────────────

  select(id: number | null): void {
    this.selectedId = id;
    this.scene.selectedId = id;
    if (id !== null) this.tab = 'selected';
    this.refresh();
  }

  setTab(t: Tab): void {
    this.tab = t;
    this.refresh();
  }

  setLogFilter(f: LogKind | 'all'): void {
    this.logFilter = f;
    this.refresh();
  }

  stanceGuard(): void {
    this.world.setPlayerStance({ kind: 'guard' });
    this.refresh();
  }

  stanceAuto(): void {
    this.world.setPlayerStance({ kind: 'auto' });
    this.refresh();
  }

  stanceRest(): void {
    this.world.setPlayerStance({ kind: 'rest' });
    this.refresh();
  }

  stanceRoam(): void {
    this.world.setPlayerStance({ kind: 'roam' });
    this.refresh();
  }

  async openChallenge(): Promise<void> {
    const w = this.world;
    const p = w.player;
    if (!p) return;
    const myHoko = hokoDisplay(p, w.year);
    // 見立ては開いた時点で一度だけ計算し、絞り込みや並べ替えで使い回す
    const rows = w.challengeTargets().map((t) => {
      const m = w.get(t.id)!;
      return { t, m, v: w.challengeVerdict(m), estrus: t.isHolder ? w.slotEstrus(t.slot!) : null };
    });
    const remaining = w.estrusRemaining();
    const late = w.day >= 28 || remaining <= 2;
    const id = await ask<number | null>((done) => {
      let holdersOnly = false;
      let byOdds = false;
      const list = h('div', { class: 'list' });
      const render = () => {
        clear(list);
        let shown = rows.filter((r) => !holdersOnly || r.t.isHolder);
        if (byOdds) shown = [...shown].sort((a, b) => (b.v.kind === 'displayWin' ? 2 : b.v.odds) - (a.v.kind === 'displayWin' ? 2 : a.v.odds));
        for (const { t, m, v, estrus } of shown) {
          const oddsText = `勝ち目${Math.round(v.odds * 10)}割`;
          // プレイヤーは見せ合いで自分からは引かないので、分が悪くても取っ組み合うかどうかの判断になる
          const verdict =
            v.kind === 'displayLose' ? `見せ合いでは分が悪い・組めば${oddsText}` : v.kind === 'displayWin' ? '見せ合いで勝てそう' : `互角・組めば${oddsText}`;
          list.append(
            h(
              'button',
              { class: 'btn item', onclick: () => done(t.id) },
              h(
                'span',
                null,
                t.isHolder ? '♛ ' : '',
                m.name,
                h('span', { class: 'sub' }, ` ${w.age(m)}歳・${Math.round(bodyMass(m, w.year))}kg${t.isHolder ? `・ハーレム${w.slotFemales(t.slot!).length}頭` : ''}`),
                // 奪ったときの見返り：いま発情しているメスと、これから発情するメス
                estrus ? h('span', { class: estrus.now + estrus.later > 0 ? 'up' : 'sub' }, `・発情中${estrus.now}・これから${estrus.later}`) : null,
                // 主は繁殖期の後半ほど痩せて弱る
                t.isHolder ? h('span', { class: m.condition < 0.4 ? 'down' : 'sub' }, `・脂肪${Math.round(m.condition * 100)}%${m.condition < 0.4 ? '（痩せてきた）' : ''}`) : null,
                // メスの手入れで乗ったツヤの分だけ、ホコは大きく見える
                m.shine > 0.02 ? h('span', { class: 'sub' }, `・ツヤ+${Math.round(m.shine * 100)}%`) : null,
              ),
              h('span', { class: 'sub' }, verdict),
              h('span', null, `推定${t.perceived.toFixed(1)}cm`),
            ),
          );
        }
        if (shown.length === 0) list.append(h('div', { class: 'sub' }, '浜に挑める相手がいない。'));
      };
      const filterBtn = btn('主だけ', () => {
        holdersOnly = !holdersOnly;
        filterBtn.classList.toggle('on', holdersOnly);
        render();
      }, 'small');
      const sortBtn = btn('勝ち目順', () => {
        byOdds = !byOdds;
        sortBtn.classList.toggle('on', byOdds);
        render();
      }, 'small');
      render();
      return h(
        'div',
        null,
        h('h2', null, '誰に挑む？'),
        late ? h('div', { class: 'note', style: 'margin-bottom:4px' }, `この浜で発情を残しているメスは、あと${remaining}頭ほど。いま浜を奪っても、今季はつがえないかもしれない。`) : null,
        h('div', { class: 'sub' }, `あなたのホコ：${myHoko.toFixed(1)}cm・体重 ${Math.round(bodyMass(p, w.year))}kg・脂肪 ${Math.round(p.condition * 100)}%。相手の大きさは見た目の推定で、多少の見誤りがある。`),
        h('div', { class: 'sub' }, '浜の主は簡単には引かないので、見せ合いで勝つには 2 割ほど大きいホコが要る。それ以外は取っ組み合うかどうかの判断になり、体重と脂肪がものを言う。主に勝てば、その浜とハーレムを奪える。挑めるのは 1 日 1 回で、次に日を進めたときに勝負になる。'),
        h('div', { class: 'tabs', style: 'margin:6px 0' }, filterBtn, sortBtn),
        list,
        h('div', { class: 'row' }, btn('やめる', () => done(null))),
      );
    });
    if (id !== null) {
      w.setPlayerStance({ kind: 'challenge', targetId: id });
      w.pushLog(`明日、${w.get(id)!.name}に挑むことにした。`, 'player', p.id);
    }
    this.refresh();
  }

  async openSlotPick(kind: 'follow' | 'infiltrate'): Promise<void> {
    const w = this.world;
    const p = w.player;
    if (!p) return;
    const slot = await ask<number | null>((done) => {
      const list = h('div', { class: 'list' });
      w.slotHolders.forEach((hid, s) => {
        const holder = w.get(hid);
        if (!holder) return;
        const n = w.slotFemales(s).length;
        list.append(
          h(
            'button',
            { class: 'btn item', onclick: () => done(s) },
            h('span', null, holder.name, h('span', { class: 'sub' }, ` ${w.age(holder)}歳・${holder.base.aggression > 0.6 ? '短気' : holder.base.aggression < 0.4 ? '温厚' : '並'}`)),
            h('span', { class: 'sub' }, `見張り${w.guardCap(holder)}`),
            h('span', null, `メス${n}頭`),
          ),
        );
      });
      return h(
        'div',
        null,
        h('h2', null, kind === 'follow' ? 'どの主に付き従う？' : 'どの浜に紛れ込む？'),
        h(
          'div',
          { class: 'sub' },
          kind === 'follow'
            ? '衛星型は主のそばに控え、主が喧嘩している隙にメスとつがう。喧嘩の多い浜ほど好機が多い。'
            : '忍び型はメスに似た姿でハーレムに紛れ込む。見張りが手一杯な浜ほど見つかりにくい。仲間が多い浜では主も疑い深くなる。',
        ),
        list,
        h('div', { class: 'row' }, btn('やめる', () => done(null))),
      );
    });
    if (slot !== null) w.setPlayerStance(kind === 'follow' ? { kind: 'follow', slot } : { kind: 'infiltrate', slot });
    this.refresh();
  }

  /** 主として、ハーレムのメスに構う。femaleId を渡すと、その子の行動から始まる。 */
  async openAttend(femaleId?: number): Promise<void> {
    const w = this.world;
    const p = w.player;
    const s = p ? w.slotOf(p) : null;
    if (!p || s === null) return;
    let target = femaleId ?? null;
    for (;;) {
      if (target === null) {
        const pick = await this.pickHaremFemale(s);
        if (pick === null) break;
        if (pick === 'soothe') {
          w.setPlayerStance({ kind: 'soothe' });
          break;
        }
        target = pick;
      }
      const f = w.get(target);
      if (!f) break;
      const stance = await this.pickFemaleAction(f, femaleId === undefined);
      if (stance === 'back') {
        target = null;
        continue;
      }
      if (stance) w.setPlayerStance(stance);
      break;
    }
    this.refresh();
  }

  private pickHaremFemale(slot: number): Promise<number | 'soothe' | null> {
    const w = this.world;
    // 発情中 → 発情が近い順 → 発情の終わったメス
    const soon = (f: Individual) => (w.femaleStatus(f).estrus ? -1 : f.estrusStart > w.day ? f.estrusStart - w.day : 999);
    const females = [...w.slotFemales(slot)].sort((a, b) => soon(a) - soon(b) || b.loyalty - a.loyalty);
    return ask<number | 'soothe' | null>((done) => {
      const list = h('div', { class: 'list' });
      for (const f of females) {
        const st = w.femaleStatus(f);
        list.append(
          h(
            'button',
            { class: `btn item ${st.estrus ? 'primary' : ''}`, onclick: () => done(f.id) },
            h('span', null, f.name, h('span', { class: 'sub' }, ` ${w.age(f)}歳・${moodLabel(f.loyalty)}`), ' ', h('span', { class: 'stars' }, bloodStars(w, f))),
            h('span', { class: 'sub' }, f.base.pref > 0.6 ? 'ホコ好き' : f.base.pref < 0.4 ? '穏やか好き' : ''),
            h('span', null, st.label),
          ),
        );
      }
      if (females.length === 0) list.append(h('div', { class: 'sub' }, 'ハーレムにメスがいない。'));
      return h(
        'div',
        null,
        h('h2', null, `ハーレムのメスたち（${females.length}頭）`),
        h(
          'button',
          { class: 'btn choice', onclick: () => done('soothe') },
          h('div', { class: 'btn-body' }, h('div', { class: 'name' }, 'ハーレム全体をなだめる'), h('div', { class: 'sub' }, '低い声で鳴いて落ち着かせる。浜の騒がしさが収まり、みんなの機嫌が少し良くなり、出ていくメスが減る。')),
        ),
        h('h3', null, '一頭に構う'),
        list,
        h('div', { class: 'row' }, btn('やめる', () => done(null))),
      );
    });
  }

  private pickFemaleAction(f: Individual, canGoBack: boolean): Promise<Stance | 'back' | null> {
    const w = this.world;
    const p = w.player!;
    const st = w.femaleStatus(f);
    const pup = w.get(f.pupId);
    return ask<Stance | 'back' | null>((done) => {
      const choice = (title: string, desc: string, stance: Stance, opts: { disabled?: boolean; primary?: boolean } = {}) =>
        h(
          'button',
          { class: `btn choice ${opts.primary ? 'primary' : ''}`, disabled: opts.disabled, onclick: () => done(stance) },
          h('div', { class: 'btn-body' }, h('div', { class: 'name' }, title), h('div', { class: 'sub' }, desc)),
        );
      const groom = (type: GroomType, label: string, effect: string) =>
        choice(`${label}をさせる`, effect, { kind: 'groom', femaleId: f.id, type });
      return h(
        'div',
        null,
        h('div', { class: 'card-head' }, portrait(f, w), h('div', null, h('h2', { style: 'margin:0' }, f.name), h('div', { class: 'sub' }, `${w.age(f)}歳・${st.label}`))),
        h(
          'div',
          { class: 'stat' },
          h('span', { class: 'k' }, '機嫌'),
          bar(f.loyalty, 'love'),
          h('span', { class: 'v' }, moodLabel(f.loyalty)),
        ),
        h('div', { class: 'sub' }, `好み：${f.base.pref > 0.6 ? '大きなホコ' : f.base.pref < 0.4 ? '穏やかなオス' : 'こだわらない'}${pup?.alive ? `・子の${pup.name}を育てている` : ''}`),
        (() => {
          const est = bloodEstimate(f, (id) => w.get(id), w.inds.values());
          if (!est) return h('div', { class: 'sub', style: 'margin-bottom:6px' }, '血筋：父も兄弟も知れない。');
          const son = (p.base.hoko + est.value) / 2;
          return h(
            'div',
            { style: 'margin-bottom:6px' },
            h('span', { class: 'sub' }, '血筋 '),
            h('span', { class: 'stars' }, starText(potentialStars(est.value, w.herdHokoMean()))),
            h('span', { class: 'sub' }, `（${est.clues.join('・')}から）　`),
            `あなたとの息子の見込み：ホコ 約${son.toFixed(0)}cm`,
          );
        })(),
        h(
          'div',
          { class: 'choices' },
          choice('つがう', st.estrus ? '発情中。いまなら受け入れてくれる。' : 'いまは発情していない。迫っても突っぱねられ、機嫌を損ねる。', { kind: 'court', femaleId: f.id }, { primary: st.estrus }),
          h('h3', null, 'ご機嫌を取る'),
          choice('毛づくろいしてあげる', '主のほうから背中をかいてやる。機嫌が大きく良くなる。', { kind: 'tend', femaleId: f.id }),
          choice('寄り添って守る', `一日そばにつく。ほかのオスを寄せつけず、${pup?.alive ? '子が喧嘩で踏まれることもない。' : '発情中ならまず自分がつがえる。'}`, { kind: 'escort', femaleId: f.id }),
          h('h3', null, '世話をさせる'),
          groom('hoko', 'ホコの手入れ', `ツヤが出て見せ合いで有利に。いまのツヤ +${Math.round(p.shine * 100)}%`),
          groom('wound', '傷の手当て', `傷が癒える。いまのケガ ${Math.round(p.injury * 100)}%`),
          groom('fur', '毛づくろい', '少し脂肪が戻る。機嫌の悪いメスは嫌がる。'),
        ),
        h('div', { class: 'sub', style: 'margin-top:6px' }, 'どれもその日限り。一頭にかかりきりの日は、ほかのメスへの見張りが手薄になる。'),
        h('div', { class: 'row' }, canGoBack ? btn('一覧へ戻る', () => done('back')) : null, btn('やめる', () => done(null))),
      );
    });
  }

  private onKey(e: KeyboardEvent): void {
    if (isModalOpen() || this.mode !== 'season') return;
    if (e.key === ' ') {
      e.preventDefault();
      this.togglePlay();
    } else if (e.key === 'Enter' || e.key === 'n') {
      void this.stepDay();
    }
  }

  private togglePlay(): void {
    this.playing = !this.playing;
    this.dayClock = this.dayMs();
    this.renderTop();
  }

  // ───────────────────────── 描画まわり ─────────────────────────

  private fit(): void {
    const narrow = window.innerWidth <= 900;
    let scale: number;
    if (narrow) {
      scale = Math.max(1, (document.documentElement.clientWidth - 32) / VIEW_W);
    } else {
      const availW = window.innerWidth - 352 - 12 * 3 - 12;
      const availH = window.innerHeight - 48 - 56 - 12 * 5 - 150;
      scale = Math.max(1, Math.floor(Math.min(availW / VIEW_W, availH / VIEW_H)));
    }
    this.canvas.style.width = `${Math.floor(VIEW_W * scale)}px`;
    this.canvas.style.height = `${Math.floor(VIEW_H * scale)}px`;
    ($('app') as HTMLElement).style.gridTemplateColumns = narrow ? '' : `${Math.floor(VIEW_W * scale)}px 352px`;
  }

  private bindCanvas(): void {
    const tip = $('tooltip');
    const toView = (e: MouseEvent) => {
      const r = this.canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * VIEW_W, y: ((e.clientY - r.top) / r.height) * VIEW_H };
    };
    this.canvas.addEventListener('mousemove', (e) => {
      const v = toView(e);
      const id = this.scene.pick(v.x, v.y);
      this.scene.hoverId = id;
      const ind = this.world.get(id);
      if (!ind || this.mode === 'title') {
        tip.style.display = 'none';
        return;
      }
      tip.textContent = this.tooltipText(ind);
      tip.style.display = 'block';
      const r = this.canvas.getBoundingClientRect();
      const left = e.clientX - r.left + 14;
      tip.style.left = `${Math.max(4, Math.min(left, r.width - tip.offsetWidth - 4))}px`;
      tip.style.top = `${e.clientY - r.top + 14}px`;
    });
    this.canvas.addEventListener('mouseleave', () => {
      tip.style.display = 'none';
      this.scene.hoverId = null;
    });
    this.canvas.addEventListener('click', (e) => {
      if (this.mode === 'title') return;
      const v = toView(e);
      this.select(this.scene.pick(v.x, v.y));
    });
  }

  private tooltipText(ind: Individual): string {
    const w = this.world;
    const age = w.age(ind);
    if (age === 0) return `${ind.name}（子・${ind.sex === 'M' ? 'オス' : 'メス'}）`;
    if (ind.sex === 'F') return `${ind.name}（メス ${age}歳・${Math.round(bodyMass(ind, w.year))}kg）`;
    if (ind.base.tactic === 'F' && ind.id !== w.playerId) return `${ind.name}（メス？ ${age}歳）`;
    const s = w.slotOf(ind);
    const size = `${Math.round(bodyMass(ind, w.year))}kg・ホコ${hokoDisplay(ind, w.year).toFixed(0)}cm`;
    return `${ind.name}（オス ${age}歳・${size}）${s !== null ? ` 主・メス${w.slotFemales(s).length}頭` : ''}`;
  }

  refresh(): void {
    this.renderTop();
    if (this.mode === 'title' || this.mode === 'loading') return;
    renderSide(this, $('side'));
    renderLog(this, $('log'));
  }

  private renderTop(): void {
    const top = $('top');
    clear(top);
    if (this.mode === 'title' || this.mode === 'loading') return;
    top.append(h('div', { class: 'title' }, 'ハマトド'));
    const w = this.world;
    const prog = w.phase === 'breeding' ? w.day / BREED_DAYS : 1;
    top.append(
      h('div', { class: 'date' }, `${w.displayYear()}年目・${w.phase === 'breeding' ? `繁殖期 ${w.day}/${BREED_DAYS}日` : '採餌期'}`),
      h('div', { class: 'season-bar' }, h('i', { style: `width:${(prog * 100).toFixed(1)}%` })),
      h('div', { class: 'spacer' }),
    );
    const can = this.mode === 'season';
    const controls = h(
      'div',
      { class: 'controls' },
      btn(this.autoJudge ? '判断：気質任せ' : '判断：自分で', () => { this.autoJudge = !this.autoJudge; this.renderTop(); }, `small ${this.autoJudge ? 'on' : ''}`),
      btn('遊び方', () => void this.showHelp(), 'small'),
    );
    top.append(controls);
    this.renderTime(can);
  }

  /** 浜のすぐ下の時間操作 */
  private renderTime(can: boolean): void {
    const bar = $('timebar');
    clear(bar);
    if (this.mode === 'title' || this.mode === 'loading') return;
    const play = btn(
      this.playing ? h('span', null, '❚❚ 止める') : h('span', null, '▶ 自動', h('span', { class: 'wide-only' }, 'で進める')),
      () => this.togglePlay(),
      this.playing ? 'on' : 'primary',
    );
    const next = btn('次の日へ ▸', () => void this.stepDay(), '');
    const speeds = h('div', { class: 'speeds' }, h('span', { class: 'sub' }, '速さ'));
    for (const s of [1, 2, 4]) {
      speeds.append(btn(`×${s}`, () => { this.speed = s; this.renderTop(); }, `small ${this.speed === s ? 'on' : ''}`));
    }
    for (const b of [play, next, ...speeds.querySelectorAll('button')]) (b as HTMLButtonElement).disabled = !can;
    bar.append(play, next, speeds);
  }

  // ───────────────────────── 画面 ─────────────────────────

  private showTitle(): void {
    this.mode = 'title';
    this.renderTop();
    const side = $('side');
    const log = $('log');
    clear(side);
    clear(log);
    side.append(
      h(
        'div',
        { class: 'paper' },
        h('h3', { style: 'color:#733e39' }, 'ハマトドとは'),
        h('div', null, '北の浜で群れをつくる大型の海獣。オスは「ホコ」と呼ばれる生殖器を見せ合い、その大きさで序列を決める。'),
        h('div', { style: 'margin-top:8px' }, '序列の高いオスは浜を占め、メスを囲う。ハーレムのメスたちは主の世話を焼き、ホコの手入れまでする。'),
        h('div', { style: 'margin-top:8px' }, 'だが独占は完全ではない。メスは気に入らなければ去り、衛星型や忍び型のオスが隙を突く。'),
      ),
    );
    log.append(
      h('h3', null, '浜のしきたり'),
      h(
        'div',
        { class: 'entries' },
        ...[
          'オスはホコを見せ合い、小さい方が引く。僅差なら取っ組み合い。',
          '主が見張れるメスの数は、その日の脂肪しだい。',
          '騒がしい浜、狭い浜からは、メスが去っていく。',
          'メスは一度の発情で何頭ともつがいうる。父を決めるのは精子のくじ引き。',
          '大きなホコは、海ではシャチの的になる。',
          '血を残せ。当主が死んでも、血を引く者が継ぐ。',
        ].map((t) => h('div', { class: 'entry k-event' }, h('span', { class: 'when bullet' }, '・'), h('span', null, t))),
      ),
    );
    const overlay = $('overlay');
    clear(overlay);
    overlay.append(
      h(
        'div',
        { class: 'title-card win' },
        h('div', { class: 'logo' }, 'ハマトド'),
        h('div', { class: 'tagline' }, '― ホコと血統の物語 ―'),
        h('div', { class: 'btns' }, btn('はじめる', () => void this.startNewGame(), 'primary'), btn('遊び方', () => void this.showHelp())),
        h('div', { class: 'sub blink', style: 'margin-top:12px' }, 'PRESS START'),
      ),
    );
    overlay.classList.add('show');
  }

  private async startNewGame(): Promise<void> {
    const overlay = $('overlay');
    clear(overlay);
    overlay.append(h('div', { class: 'win' }, h('div', { class: 'name' }, '浜の歴史を刻んでいます…'), h('div', { class: 'sub' }, '40 年ぶんの世代交代を計算中')));
    this.mode = 'loading';
    await new Promise((r) => setTimeout(r, 50));
    const w = World.create(Math.floor(Math.random() * 1e9), 40);
    this.world = w;
    this.scene.setWorld(w);
    overlay.classList.remove('show');
    this.best = { share: 0, year: w.year };
    const options = w.founderOptions();
    const pick = await ask<number>((done) => {
      const box = h('div', { class: 'choices' });
      for (const o of options) {
        const { tag, note } = founderBlurb(o.kind, o.ind);
        box.append(this.candidateButton(o.ind, () => done(o.ind.id), tag, undefined, note, true));
      }
      return h(
        'div',
        null,
        h('h2', null, '初代を選ぶ'),
        h('div', { class: 'sub' }, `若いオスが${options.length}頭。誰として生き、血を残すか。星はホコの素質を群れの平均と比べたもの（★★★が平均）。遺伝子は子に半分ずつ受け継がれる。`),
        box,
      );
    });
    w.choosePlayer(pick, true);
    this.selectedId = pick;
    this.scene.selectedId = pick;
    this.beginSeason();
    await this.showIntro();
  }

  private candidateButton(c: Individual, onclick: () => void, extra?: string, compareTo?: Individual, note?: string, compact = false): HTMLElement {
    const w = this.world;
    const y = w.year;
    const temper = c.base.aggression > 0.62 ? '短気' : c.base.aggression < 0.38 ? '温厚' : '並の気性';
    const bold = c.base.boldness > 0.62 ? '豪胆' : c.base.boldness < 0.38 ? '慎重' : '';
    const mother = w.get(c.motherId);
    const father = w.get(c.fatherId);
    return h(
      'button',
      { class: 'btn choice', onclick },
      portrait(c, w),
      h(
        'div',
        { class: 'btn-body' },
        h('div', null, h('span', { class: 'name' }, c.name), ` ${w.age(c)}歳 `, h('span', { class: `tag ${c.base.tactic}` }, tacticLabel(c.base.tactic)), extra ? h('span', { class: 'tag gold' }, extra) : null),
        h(
          'div',
          null,
          h('span', { class: 'stars' }, starText(potentialStars(c.base.hoko, w.herdHokoMean()))),
          ` ホコの素質 ${c.base.hoko.toFixed(1)}cm`,
          compareTo
            ? h('span', { class: c.base.hoko >= compareTo.base.hoko ? 'up' : 'down' }, `（先代より${c.base.hoko >= compareTo.base.hoko ? '+' : ''}${(c.base.hoko - compareTo.base.hoko).toFixed(1)}）`)
            : null,
        ),
        h('div', { class: 'sub' }, `精巣 ${Math.round(c.base.testis)}g・体重 ${Math.round(c.base.body)}kg（成熟時）・${temper}${bold ? '・' + bold : ''}`),
        compact ? null : h('div', { class: 'sub' }, `活力 ${Math.round(c.base.vigor * 100)}%　母 ${mother?.name ?? '不明'}／父 ${father?.name ?? '不明'}`),
        compact
          ? null
          : h(
              'div',
              { class: 'note' },
              `いま：${w.slotOf(c) !== null ? `浜の主（メス${w.slotFemales(w.slotOf(c)!).length}頭）` : w.age(c) < 4 ? 'まだ子ども' : '浜なし'}・脂肪 ${Math.round(c.condition * 100)}%・来季の張り ${Math.round(hokoFirmness(c, true) * 100)}%`,
            ),
        compact ? null : h('div', { class: 'sub' }, `いまのホコ ${hokoDisplay(c, y).toFixed(1)}cm・精巣 ${Math.round(testisMass(c, y))}g・体重 ${Math.round(bodyMass(c, y))}kg`),
        note ? h('div', { class: 'note' }, note) : null,
      ),
    );
  }

  private async showIntro(): Promise<void> {
    const p = this.world.player!;
    await ask<void>((done) =>
      h(
        'div',
        null,
        h('h2', null, `${p.name}の一年目`),
        h('div', null, '繁殖期は40日。オスたちは浜でホコを見せ合い、序列を争う。'),
        h('div', { style: 'margin-top:6px' }, p.base.tactic === 'R'
          ? '主型のあなたは、主に挑んで浜を奪うか、見張りの外のメスをうかがう。'
          : p.base.tactic === 'S'
            ? '衛星型のあなたは、白い襟巻きをまとい、主のそばで隙を待つ。'
            : '忍び型のあなたは、メスに似た姿でハーレムに紛れ込む。'),
        h(
          'div',
          { style: 'margin-top:6px' },
          `時間は止まっている。まず自分の欄（スマホでは浜の下）で今日の方針を選び（迷ったら「${p.base.tactic === 'R' ? 'うろつく' : p.base.tactic === 'S' ? '付き従う…' : '紛れ込む…'}」）、浜のすぐ下の「次の日へ」か「▶ 自動」で日を進めよう。${p.base.tactic === 'R' ? '挑まれたときはその場で判断を求められる。' : ''}`,
        ),
        h(
          'div',
          { style: 'margin-top:6px' },
          p.base.tactic === 'R'
            ? `ホコはまだ育つ（素質 ${p.base.hoko.toFixed(1)}cm、7歳ごろに育ちきる）。自分よりはっきり小さいホコの主を見つけたら「挑む…」。浜を奪えばハーレムの主だ。くわしくは右上の「遊び方」。`
            : p.base.tactic === 'S'
              ? '喧嘩の多い浜の主に付き従うほど好機が多い。くわしくは右上の「遊び方」。'
              : '見張りが手一杯の大きな浜ほど見つかりにくい。くわしくは右上の「遊び方」。',
        ),
        h('div', { class: 'row' }, btn('浜へ', () => done(), 'primary')),
      ),
    );
  }

  private async showHelp(): Promise<void> {
    const sec = (title: string, ...lines: string[]) => [h('h3', null, title), ...lines.map((t) => h('div', { style: 'margin-bottom:4px' }, t))];
    await ask<void>((done) =>
      h(
        'div',
        null,
        h('h2', null, '遊び方'),
        ...sec('目的', '自分の血を群れに広げること。当主が死んだら、その血を引くオスに引き継いで続ける。「血統」の欄の血統占有率は、群れのゲノムのうち初代から受け継がれた割合。'),
        ...sec(
          '一年の流れ',
          '繁殖期（40日）：オスたちが浜で序列を争い、メスを囲う。時間は止まっていて、浜の下の「▶ 自動で進める」で日が流れ、「次の日へ」で1日ずつ進む。',
          '採餌期：繁殖期が終わると海で一年を過ごす。慎重・ふつう・貪欲から方針を選ぶ。冬のあいだに死ぬ者も出る。',
        ),
        ...sec(
          '毎日の方針（右の欄）',
          '選んだ方針は「今日の予定」に出て、日を進めたときに実行される。「守る」「おまかせ」「うろつく」「海で食べる」は変えるまで毎日続く。「挑む」と「メスに構う」はその日限りで、翌日は元の方針に戻る。',
          '挑む…：ほかのオスに勝負を挑む（5歳から）。浜の主に勝てば、その浜とハーレムを奪える。',
          'うろつく：見張りの外にいるメスをうかがう。主でなくても交尾の機会がある。',
          '海で食べる：浜を離れて食べ、脂肪を取り戻す。主がこれを選ぶと、その日はほとんど見張れない。',
          '守る（主のみ）：見張れるメスが1.3倍に増え、取っ組み合いでも粘る。',
          'おまかせ（主のみ）：毎朝ハーレムの様子を見て、守る・なだめる・機嫌の悪いメスに構う・見張りの外の発情メスに寄り添う、を自動で選ぶ。',
          'メスに構う…（主のみ）：ハーレム全体をなだめる、一頭とつがう・毛づくろいしてあげる・寄り添って守る・世話（ホコの手入れ／傷の手当て／毛づくろい）をさせる。',
        ),
        ...sec(
          '序列と勝負',
          'オス同士はまずホコを見せ合う。差がはっきりしていれば小さい方が引く。僅差なら取っ組み合いになり、体重・脂肪・気性で決まる。浜の主は守りに入ると手強い（先住効果）。',
          '挑まれたら「受けて立つ」か「引く」を選ぶ。引けばケガはしないが負けで、主なら浜を明け渡す。上の「判断」を「気質任せ」にすると、勝負の判断を自分の気性に任せて止まらずに進む。',
          '「序列」は見せ合いと取っ組み合いの戦績から決まる順位。勝つと上がり、負けると下がる。',
        ),
        ...sec(
          'ホコの大きさ',
          '素質（遺伝子で決まり、7歳まで育つ）に、繁殖期の始まりの脂肪で決まる「張り」が掛かる。痩せて浜に来るとホコの張りもなく、見せ合いで不利になる。繁殖期の途中で痩せても、張りはその季節のあいだ変わらない。ハーレムのメスにホコの手入れをしてもらうとツヤが乗り、最大で1割ほど大きく見える（大きなハーレムの主ほど手入れされ、ますます大きく見える）。12歳を過ぎると少しずつ縮む。',
        ),
        ...sec(
          '脂肪',
          '「脂肪」は体の蓄え。採餌期に食べて太り、繁殖期には日に日に痩せる（主は絶食するので特に）。「海で食べる」日は少し戻る。',
          '脂肪が多いほど：繁殖期の始まりにホコが張る（痩せきっていると素質の55%、まるまる太れば100%）。取っ組み合いの力が出る。主なら見張れるメスが増える。精子がよく作られる。浜に長くいられる。冬に飢えにくく、シャチからも逃げやすい。太りすぎて困ることはない。',
          'メスも太っているほど身ごもりやすく、子が丈夫に育つ。',
        ),
        ...sec(
          'ハーレム',
          'メスは浜に着くたびに、どの主のもとにいるかを選び直す。主の魅力（ホコの大きさ、または穏やかさ。好みはメスによる）と浜の居心地で決まる。去年身を寄せた主のもとへは戻りやすく、戻ったメスは最初からよく懐いている。懐きやすさはメスによって違う。',
          'メスの発情は、繁殖期のおよそ10〜30日目に、一頭につき3日ずつ来る。発情の終わったメスとはつがえないので、浜を奪うなら早いほど見返りが大きい。挑戦の一覧には、主ごとに発情中のメスとこれから発情するメスの数が出る。',
          '主が見張れるメスの数は脂肪で決まる。見張りを超えて混み合うとメスは窮屈で出ていき、見張りの外のメスはほかのオスとつがってしまう。浜で喧嘩が起きると騒がしくなり、子が踏まれることもあって、メスが去っていく。',
          '主は繁殖期のあいだ食べずに浜を守るので、1日に1.1%ずつ、一季で4割以上も痩せる。脂肪が13%を切ると浜にいられなくなる。メスのいない日や発情の近いメスがいない日は「海で食べる」で蓄えよう（「おまかせ」は自分でそうする）。',
        ),
        ...sec(
          '戦略の型',
          '主型：ホコを見せ合って序列を争い、ハーレムを持つ。',
          '衛星型：白いたてがみを持つ。主のそばに付き従い、主が喧嘩している隙にメスとつがう。',
          '忍び型：メスに似た小さな姿。ハーレムに紛れ込んでつがうが、見つかると追い払われる。',
        ),
        ...sec(
          '精子と遺伝',
          '交尾のたびに貯精が減り、精巣の大きさに応じて毎日補われる。メスは発情中に何頭ともつがいうるので、子の父は生き残った精子の数に比例したくじ引きで決まる。',
          'ホコ・精巣・体格・気性・メスの好みは複数の遺伝子の足し算で、子は両親から半分ずつ受け継ぐ。ホコの遺伝子はメスも持っていて息子に渡す。近親交配では有害な劣性遺伝子がそろいやすい。',
        ),
        ...sec('操作', '浜の個体をクリックすると右の欄に詳しく出る。キーボードでは、スペースで進める／止める、Enterで1日進める。'),
        h('div', { class: 'row' }, btn('閉じる', () => done(), 'primary')),
      ),
    );
  }

  private askPrompt(pr: Prompt): Promise<Answer> {
    const w = this.world;
    const opp = w.get(pr.opponentId)!;
    const p = w.player!;
    const maxCm = Math.max(70, pr.self, pr.perceivedOpp);
    const ruler = (cm: number, cls: string) => h('div', { class: `ruler ${cls}` }, h('i', { style: `height:${((cm / maxCm) * 100).toFixed(1)}%` }));
    return ask<Answer>((done) => {
      const gap = pr.perceivedOpp / Math.max(1, pr.self);
      const title =
        pr.kind === 'challenged'
          ? `${opp.name}が見せ合いを挑んできた！`
          : gap > 1.15
            ? `${opp.name}のホコは明らかに大きい`
            : gap < 0.87
              ? `${opp.name}はホコで劣るのに引かない`
              : `${opp.name}と互角のにらみ合い`;
      const lose = pr.kind === 'challenged' ? pr.slotAtStake : w.player && w.slotOf(w.player) !== null;
      const desc =
        pr.kind === 'challenged'
          ? `受けて立つ：ホコを見せ合う。差がはっきりすれば小さい方が引き、僅差ならもう一度、取っ組み合うかを選べる。引く：戦わずに負け${lose ? '、浜とハーレムを明け渡す' : '。ケガはしない'}。`
          : pr.challenger
            ? `${gap > 1.15 ? '見せ合いでは分が悪い。' : gap < 0.87 ? '相手は大きさの差を認めず、引こうとしない。' : '見せ合いでは決着がつかない。'}取っ組み合う：体格と脂肪がものを言い、負ければケガを負う。引く：自分から挑んだ勝負なので、ここで身を引いても序列の下がり方は半分で済む。`
            : `見せ合いでは決着がつかない。取っ組み合う：体格と脂肪がものを言い、負ければケガを負う${lose ? 'うえ浜を失う' : ''}。引く：ケガはしないが負け${lose ? '、浜を明け渡す' : ''}。`;
      return h(
        'div',
        null,
        h('h2', null, title),
        h('div', null, desc),
        h(
          'div',
          { class: 'versus' },
          h('div', { class: 'side' }, portrait(p, w, { rear: true }), h('div', { class: 'name' }, `${p.name}（あなた）`), ruler(pr.self, ''), h('div', null, `${pr.self.toFixed(1)}cm`), pr.kind === 'escalate' ? h('div', { class: 'sub' }, `体重 ${Math.round(pr.selfBody)}kg`) : null),
          h('div', { class: 'vs' }, 'VS'),
          h('div', { class: 'side' }, portrait(opp, w, { rear: true }), h('div', { class: 'name' }, opp.name), ruler(pr.perceivedOpp, 'opp'), h('div', null, `推定 ${pr.perceivedOpp.toFixed(1)}cm`), pr.kind === 'escalate' ? h('div', { class: 'sub' }, `体重 ${Math.round(pr.oppBody)}kg`) : null),
        ),
        h('div', { class: 'sub' }, `相手の${opp.base.aggression > 0.62 ? '目は血走っている' : opp.base.aggression < 0.38 ? '様子は落ち着いている' : '出方はわからない'}。あなたの脂肪 ${Math.round(p.condition * 100)}%・ケガ ${Math.round(p.injury * 100)}%`),
        pr.kind === 'escalate' ? h('div', { class: 'name' }, `取っ組み合いの勝ち目：およそ${Math.round(pr.winChance * 10)}割`) : null,
        h(
          'div',
          { class: 'row' },
          btn('今回は気質に任せる', () => done(w.aiAnswer(pr)), 'small'),
          btn('引く', () => done('retreat')),
          btn(pr.kind === 'challenged' ? '受けて立つ' : '取っ組み合う', () => done('accept'), 'primary'),
        ),
      );
    });
  }

  private showSeasonReport(s: SeasonSummary): Promise<ForageStrategy> {
    const w = this.world;
    const p = w.player!;
    const line = (k: string, v: string) => h('tr', null, h('td', null, k), h('td', { class: 'r' }, v));
    const outlook = (st: ForageStrategy) => {
      const o = w.forageOutlook(st);
      const sign = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}`;
      const range = Math.round(o.lo * 100) === Math.round(o.hi * 100) ? `${sign(o.delta)}%` : `${sign(o.lo)}〜${sign(o.hi)}%`;
      return `見込み：脂肪 ${range}（来季のホコの張り 約${Math.round((0.55 + 0.45 * Math.min(1, Math.max(0, p.condition + o.delta))) * 100)}%）・シャチに襲われる確率 ${(o.orca * 100).toFixed(1)}%`;
    };
    return ask<ForageStrategy>((done) => {
      const choice = (key: ForageStrategy, label: string, desc: string) =>
        h('button', { class: `btn choice ${key === 'normal' ? 'primary' : ''}`, onclick: () => done(key) }, h('div', { class: 'btn-body' }, h('div', { class: 'name' }, label), h('div', { class: 'sub' }, desc)));
      return h(
        'div',
        null,
        h('h2', null, `${w.displayYear(s.year)}年目の繁殖期が終わった`),
        p.thought ? h('div', { class: 'thought' }, `${p.name}「${p.thought.text}」`) : null,
        h(
          'table',
          { class: 'mini', style: 'margin:8px 0' },
          line('交尾', `${s.playerMatings}回`),
          line('ハーレム', s.playerWasHolder ? `最大${s.playerPeakHarem}頭` : 'なし'),
          line('見せ合い', `${s.playerDisplays[0]}勝${s.playerDisplays[1]}敗`),
          line('取っ組み合い', `${s.playerFights[0]}勝${s.playerFights[1]}敗`),
          line('あなたの子を宿したメス', `${s.playerConceptions}頭（群れ全体で${s.conceptions}頭）`),
          line('脂肪', `${Math.round(p.condition * 100)}%`),
        ),
        h('h3', null, '採餌期の過ごし方'),
        h(
          'div',
          { class: 'choices' },
          choice('cautious', '慎重に', `浅瀬で少しずつ食べる。${outlook('cautious')}`),
          choice('normal', 'ふつうに', `いつもどおり沖へ出る。${outlook('normal')}`),
          choice('greedy', '貪欲に', `遠くの餌場まで行く。ホコが大きいほど泳ぎが遅く、シャチに狙われやすい。${outlook('greedy')}`),
        ),
      );
    });
  }

  private showForageReport(rep: ForageReport, strategy: ForageStrategy): Promise<void> {
    const w = this.world;
    const p = w.player;
    const notable = rep.deaths.filter((d) => d.dynasty > 0 && d.age > 0);
    const pupDeaths = rep.deaths.filter((d) => d.dynasty > 0 && d.age === 0).length;
    const total = rep.deaths.length;
    const orcaKills = rep.deaths.filter((d) => d.cause === 'orca').length;
    return ask<void>((done) =>
      h(
        'div',
        null,
        h('h2', null, '採餌期が過ぎた'),
        h('div', null, `海で${strategy === 'cautious' ? '慎重に' : strategy === 'greedy' ? '貪欲に' : ''}食べて過ごした一年。群れでは${total}頭が命を落とした。${orcaKills ? `うち${orcaKills}頭はシャチに襲われた。` : ''}`),
        rep.playerDied
          ? h('div', { class: 'thought', style: 'color:#e43b44' }, `${w.get(w.playerId)!.name}は${causeLabel(rep.playerCause!)}で世を去った。`)
          : p
            ? h('div', { class: 'sub' }, `脂肪 ${rep.conditionDelta >= 0 ? '+' : ''}${Math.round(rep.conditionDelta * 100)}% → ${Math.round(p.condition * 100)}%（来季のホコの張り ${Math.round(hokoFirmness(p, true) * 100)}%）`)
            : null,
        notable.length ? h('h3', null, '一族の訃報') : null,
        ...notable.filter((d) => d.id !== w.playerId).slice(0, 8).map((d) => h('div', { class: 'sub' }, `${d.name}（${d.age}歳）…${causeLabel(d.cause)}`)),
        pupDeaths ? h('div', { class: 'sub' }, `一族の子${pupDeaths}頭が冬を越せなかった。`) : null,
        ...rep.milestones.map((m) => h('div', { class: 'name', style: 'color:#fee761' }, `節目：血統占有率が${Math.round(m * 100)}%を超えた！`)),
        p && p.thought && !rep.playerDied ? h('div', { class: 'thought' }, `「${p.thought.text}」`) : null,
        h('div', { class: 'row' }, btn(rep.playerDied ? '跡継ぎを選ぶ' : '次の繁殖期へ', () => done(), 'primary')),
      ),
    );
  }

  private async chooseHeir(): Promise<boolean> {
    const w = this.world;
    let cands = w.heirCandidates();
    const prev = w.get(w.playerId);
    if (cands.length === 0) {
      // 息子はいなくても、娘たちに血が残っていれば、孫息子の誕生を待つ
      const daughters = w.living().filter((i) => i.sex === 'F' && i.dynasty > 0);
      const carriers = w.carriersOfLine().filter((f) => !daughters.includes(f));
      if (daughters.length === 0 && carriers.length === 0) {
        await this.gameOver();
        return false;
      }
      const names = (xs: Individual[]) => xs.map((d) => d.name).join('、');
      await ask<void>((done) =>
        h(
          'div',
          null,
          h('h2', null, daughters.length ? '血は娘たちに' : '血はまだおなかの中に'),
          h(
            'div',
            null,
            `跡を継げるオスはいない。だが、${[daughters.length ? `${names(daughters)}がその血を引いている` : '', carriers.length ? `${names(carriers)}が一族の子を身ごもっている` : ''].filter(Boolean).join('。そして')}。`,
          ),
          h('div', { style: 'margin-top:6px' }, '息子が生まれ、育つのを待とう。'),
          h('div', { class: 'row' }, btn('時を待つ', () => done(), 'primary')),
        ),
      );
      const waited = w.waitForHeir(20);
      cands = w.heirCandidates();
      if (cands.length === 0) {
        await this.gameOver();
        return false;
      }
      w.pushLog(`${waited}年の時が流れた。`, 'event');
      this.scene.setWorld(w);
    }
    const id = await ask<number>((done) => {
      const box = h('div', { class: 'choices' });
      for (const c of cands.slice(0, 6)) {
        const rel = c.fatherId === prev?.id ? '息子' : c.motherId && w.get(c.motherId)?.fatherId === prev?.id ? '娘の子' : '一族';
        box.append(this.candidateButton(c, () => done(c.id), rel, prev));
      }
      return h(
        'div',
        null,
        h('h2', null, '跡継ぎを選ぶ'),
        h('div', { class: 'sub' }, `${prev?.name ?? '当主'}の血を引くオスたち。血の濃い順。星はホコの素質を群れの平均と比べたもの（★★★が平均）。素質の高い子を継がせるほど、一族は代を重ねて大きくなる。戦略の型も遺伝子で決まるので、衛星型や忍び型の父からも主型の息子が生まれる。`),
        box,
      );
    });
    w.choosePlayer(id, false);
    this.select(id);
    return true;
  }

  private async gameOver(): Promise<void> {
    const w = this.world;
    this.refresh();
    this.mode = 'over';
    const founder = w.get(w.founderId);
    const descendants = [...w.inds.values()].filter((i) => i.dynasty > 0).length;
    await ask<void>((done) =>
      h(
        'div',
        null,
        h('h2', null, '血は絶えた'),
        h('div', null, `${founder?.name ?? '初代'}に始まる血統は、${w.generation}代で途絶えた。`),
        h(
          'table',
          { class: 'mini', style: 'margin:8px 0' },
          h('tr', null, h('td', null, '続いた年数'), h('td', { class: 'r' }, `${w.year - w.startYear}年`)),
          h('tr', null, h('td', null, '生まれた一族'), h('td', { class: 'r' }, `${descendants}頭`)),
          h('tr', null, h('td', null, '最高の血統占有率'), h('td', { class: 'r' }, `${(this.best.share * 100).toFixed(1)}%（${w.displayYear(this.best.year)}年目）`)),
        ),
        h('div', { class: 'row' }, btn('タイトルへ', () => done(), 'primary')),
      ),
    );
    location.reload();
  }
}

/** 初代の候補の種類ごとの名札と、遊び方のひとこと */
function founderBlurb(kind: FounderOption['kind'], ind: Individual): { tag: string; note: string } {
  switch (kind) {
    case 'big':
      return { tag: '大物・やさしい', note: 'ホコの素質が同年代でいちばん大きい。7歳ごろに育ちきれば、見せ合いで主の座を狙える。' };
    case 'mid':
      return { tag: '並・ふつう', note: '群れの中ほど。相手を選び、駆け引きで浜を取る。' };
    case 'small':
      return { tag: '小兵・むずかしい', note: '見せ合いでは分が悪い。そのぶん精巣が大きく、うろついて見張りの外のメスとつがえば、精子のくじ引きで勝てる。' };
    case 'odd': {
      // 平均では主型と同じくらい子を残すが、上限は低い。型は遺伝子で決まるので息子は主型にもなりうる。
      const caveat = '毎年安定して子を残せるが、ハーレムは持てないので血を大きく広げるのは難しい。息子が主型に生まれれば、大物の道に戻れる。';
      return ind.base.tactic === 'S'
        ? { tag: '変わり種', note: `衛星型。白いたてがみで主のそばに控え、主が喧嘩する隙につがう。${caveat}` }
        : { tag: '変わり種', note: `忍び型。メスに似た姿でハーレムに紛れ込む。体は小さいが精巣は大きい。${caveat}` };
    }
  }
}

function bloodStars(w: World, f: Individual): string {
  const est = bloodEstimate(f, (id) => w.get(id), w.inds.values());
  return est ? `血筋${starText(potentialStars(est.value, w.herdHokoMean()))}` : '';
}

function moodLabel(loyalty: number): string {
  return loyalty > 0.6 ? '慕っている' : loyalty > 0.3 ? 'なついている' : loyalty > 0.1 ? 'よそよそしい' : '不満げ';
}

const game = new Game();
if (import.meta.env.DEV) (window as unknown as { game: Game }).game = game;
