import '@fontsource/dotgothic16';
import './style.css';
import { Scene, VIEW_H, VIEW_W } from './render/scene';
import { bodyMass, hokoDisplay, tacticLabel, testisMass, type Individual } from './sim/individual';
import {
  BREED_DAYS,
  World,
  causeLabel,
  type Answer,
  type ForageReport,
  type ForageStrategy,
  type GroomType,
  type LogKind,
  type Prompt,
  type SeasonSummary,
} from './sim/world';
import { btn, clear, h } from './ui/dom';
import { installFrames } from './ui/frame';
import { ask, isModalOpen } from './ui/modal';
import { renderLog, renderSide, type GameView, type Tab } from './ui/panels';
import { portrait } from './ui/portrait';

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
      if (w.day >= BREED_DAYS) {
        this.playing = false;
        await this.endSeason();
      }
    } finally {
      this.stepping = false;
    }
  }

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
    const targets = w.challengeTargets();
    const myHoko = hokoDisplay(p, w.year);
    const id = await ask<number | null>((done) => {
      const list = h('div', { class: 'list' });
      for (const t of targets) {
        const m = w.get(t.id)!;
        const ratio = t.perceived / myHoko;
        const verdict = ratio > 1.12 ? '分が悪い' : ratio > 1.03 ? '互角かやや上' : ratio > 0.95 ? '互角' : '勝てそう';
        list.append(
          h(
            'button',
            { class: 'btn item', onclick: () => done(t.id) },
            h('span', null, t.isHolder ? '♛ ' : '', m.name, h('span', { class: 'sub' }, ` ${w.age(m)}歳 ${t.isHolder ? `ハーレム${w.slotFemales(t.slot!).length}頭` : ''}`)),
            h('span', { class: 'sub' }, verdict),
            h('span', null, `推定${t.perceived.toFixed(1)}cm`),
          ),
        );
      }
      if (targets.length === 0) list.append(h('div', { class: 'sub' }, '浜に挑める相手がいない。'));
      return h(
        'div',
        null,
        h('h2', null, '誰に挑む？'),
        h('div', { class: 'sub' }, `あなたのホコ：${myHoko.toFixed(1)}cm。相手の大きさは見た目の推定で、多少の見誤りがある。主に勝てば、その浜とハーレムを奪える。ただし浜の主は守りに入ると手強い。`),
        h('div', { class: 'sub' }, '挑めるのは 1 日 1 回。選んだ相手とは、次に日を進めたときに勝負になる。'),
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

  /** 主として、ハーレムのメスに迫る相手を選ぶ */
  async openCourt(): Promise<void> {
    const w = this.world;
    const p = w.player;
    const s = p ? w.slotOf(p) : null;
    if (!p || s === null) return;
    // 発情中 → 発情が近い順 → 発情の終わったメス
    const soon = (f: Individual) => (w.femaleStatus(f).estrus ? -1 : f.estrusStart > w.day ? f.estrusStart - w.day : 999);
    const females = [...w.slotFemales(s)].sort((a, b) => soon(a) - soon(b) || b.loyalty - a.loyalty);
    const id = await ask<number | null>((done) => {
      const list = h('div', { class: 'list' });
      for (const f of females) {
        const st = w.femaleStatus(f);
        list.append(
          h(
            'button',
            { class: `btn item ${st.estrus ? 'primary' : ''}`, onclick: () => done(f.id) },
            h('span', null, f.name, h('span', { class: 'sub' }, ` ${w.age(f)}歳・愛着${Math.round(f.loyalty * 100)}%`)),
            h('span', { class: 'sub' }, f.base.pref > 0.6 ? 'ホコ好き' : f.base.pref < 0.4 ? '穏やか好き' : ''),
            h('span', null, st.label),
          ),
        );
      }
      if (females.length === 0) list.append(h('div', { class: 'sub' }, 'ハーレムにメスがいない。'));
      return h(
        'div',
        null,
        h('h2', null, '誰とつがう？'),
        h('div', { class: 'sub' }, '受け入れてくれるのは発情中のメスだけ。発情していないメスに迫ると突っぱねられ、愛着が下がる。一頭にかまけている日は、ほかのメスへの見張りが手薄になる。'),
        list,
        h('div', { class: 'row' }, btn('やめる', () => done(null))),
      );
    });
    if (id !== null) w.setPlayerStance({ kind: 'court', femaleId: id });
    this.refresh();
  }

  /** 主として、ハーレムのメスに世話をさせる */
  async openGroomOrder(): Promise<void> {
    const w = this.world;
    const p = w.player;
    const s = p ? w.slotOf(p) : null;
    if (!p || s === null) return;
    const females = [...w.slotFemales(s)].sort((a, b) => b.loyalty - a.loyalty);
    const pick = await ask<{ id: number; type: GroomType } | null>((done) => {
      const list = h('div', { class: 'groom-list' });
      for (const f of females) {
        const mood = f.loyalty > 0.6 ? '慕っている' : f.loyalty > 0.3 ? 'なついている' : f.loyalty > 0.1 ? 'よそよそしい' : '不満げ';
        list.append(
          h(
            'div',
            { class: 'groom-row' },
            h('div', { class: 'who-col' }, h('span', { class: 'name' }, f.name), h('span', { class: 'sub' }, ` 愛着${Math.round(f.loyalty * 100)}%・${mood}`)),
            h(
              'div',
              { class: 'groom-btns' },
              ...(['hoko', 'wound', 'fur'] as GroomType[]).map((t) => btn(t === 'hoko' ? 'ホコ' : t === 'wound' ? '傷' : '毛', () => done({ id: f.id, type: t }), 'small')),
            ),
          ),
        );
      }
      if (females.length === 0) list.append(h('div', { class: 'sub' }, 'ハーレムにメスがいない。'));
      return h(
        'div',
        null,
        h('h2', null, '誰に世話をさせる？'),
        h(
          'div',
          { class: 'sub' },
          `ホコの手入れはツヤが出て見せ合いで有利に、傷の手当ては傷を癒やし、毛づくろいは少し体力が戻る。愛着の低いメスは嫌がり、断られると愛着が下がる。不満がたまったメスは浜を去ることもある。いまのケガ ${Math.round(p.injury * 100)}%・ツヤ +${Math.round(p.shine * 100)}%`,
        ),
        list,
        h('div', { class: 'row' }, btn('やめる', () => done(null))),
      );
    });
    if (pick) w.setPlayerStance({ kind: 'groom', femaleId: pick.id, type: pick.type });
    this.refresh();
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
      tip.style.left = `${Math.min(left, r.width - tip.offsetWidth - 4)}px`;
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
      h('div', { class: 'date' }, `${w.displayYear()}年目・${w.phase === 'breeding' ? `繁殖期 ${Math.min(w.day + 1, BREED_DAYS)}日目` : '採餌期'}`),
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
    const play = btn(this.playing ? '❚❚ 止める' : '▶ 自動で進める', () => this.togglePlay(), this.playing ? 'on' : 'primary');
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
          '主が見張れるメスの数は、その日の体力しだい。',
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
    const cands = w.founderCandidates();
    const pick = await ask<number>((done) => {
      const box = h('div', { class: 'choices' });
      for (const c of cands) box.append(this.candidateButton(c, () => done(c.id)));
      return h(
        'div',
        null,
        h('h2', null, '初代を選ぶ'),
        h('div', { class: 'sub' }, '若いオスが三頭。誰として生き、血を残すか。数字は今の姿で、遺伝子は子に半分ずつ受け継がれる。'),
        box,
      );
    });
    w.choosePlayer(pick, true);
    this.selectedId = pick;
    this.scene.selectedId = pick;
    this.beginSeason();
    await this.showIntro();
  }

  private candidateButton(c: Individual, onclick: () => void, extra?: string): HTMLElement {
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
          { class: 'sub' },
          `成熟時ホコ ${c.base.hoko.toFixed(1)}cm・精巣 ${Math.round(c.base.testis)}g・体重 ${Math.round(c.base.body)}kg`,
        ),
        h('div', { class: 'sub' }, `${temper}${bold ? '・' + bold : ''}・活力 ${Math.round(c.base.vigor * 100)}%　母 ${mother?.name ?? '不明'}／父 ${father?.name ?? '不明'}`),
        h('div', { class: 'sub' }, `いまのホコ ${hokoDisplay(c, y).toFixed(1)}cm・精巣 ${Math.round(testisMass(c, y))}g・体重 ${Math.round(bodyMass(c, y))}kg`),
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
        h('div', { style: 'margin-top:6px' }, '時間は止まっている。浜のすぐ下の「▶ 自動で進める」で日が流れ、「次の日へ」で 1 日ずつ進む。方針（挑む・守るなど）は日が進む前にいつでも選べる。挑まれたときはその場で判断を求められる。'),
        h('div', { class: 'row' }, btn('浜へ', () => done(), 'primary')),
      ),
    );
  }

  private async showHelp(): Promise<void> {
    await ask<void>((done) =>
      h(
        'div',
        null,
        h('h2', null, '遊び方'),
        h('h3', null, '目的'),
        h('div', null, '自分の血を群れに広げること。当主が死んだら、その血を引くオスに引き継いで続ける。「血統」の欄で、群れのゲノムのうち初代から受け継がれた割合が見られる。'),
        h('h3', null, '序列'),
        h('div', null, 'オス同士はまずホコを見せ合う。差がはっきりしていれば小さい方が引く。僅差なら取っ組み合いになり、体格・体力・気性で決まる。'),
        h('h3', null, 'ハーレム'),
        h('div', null, '主が見張れるメスの数は体力で決まる。過密になったり、喧嘩で騒がしくなったりすると、メスは他の浜へ移る。ハーレムのメスは主の毛づくろい、傷の手当て、ホコの手入れをしてくれる。'),
        h('h3', null, '精子競争'),
        h('div', null, '交尾のたびに貯精が減り、精巣の大きさに応じて毎日補われる。メスは発情中に複数のオスとつがうことがあり、子の父は生き残った精子の数に比例したくじ引きで決まる。'),
        h('h3', null, '遺伝'),
        h('div', null, 'ホコ・精巣・体格・気性・メスの好みは複数の遺伝子の足し算。ホコの遺伝子はメスも持っていて息子に渡す。Y染色体のホコ遺伝子は父から息子へだけ伝わる。戦略は一つのスーパージーンで決まり、衛星型と忍び型の遺伝子は二本そろうと胚が育たない。近親交配では有害な劣性遺伝子がそろいやすい。'),
        h('h3', null, '採餌期'),
        h('div', null, '繁殖期のあとは海で食べて体力を戻す。欲張るほど太れるが、シャチに狙われやすい。ホコが大きいほど泳ぎが遅く、狙われやすい。'),
        h('h3', null, '操作'),
        h('div', null, '浜の下の「▶ 自動で進める」で時間が流れ、「次の日へ」で 1 日ずつ進む。キーボードでは、スペースで進める／止める、Enter で 1 日進める。浜の個体をクリックすると詳しく見られる。'),
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
      const title = pr.kind === 'challenged' ? `${opp.name}が見せ合いを挑んできた！` : `${opp.name}と互角のにらみ合い`;
      const desc =
        pr.kind === 'challenged'
          ? pr.slotAtStake
            ? '負ければ浜とハーレムを奪われる。'
            : '受ければ序列を賭けた見せ合いになる。'
          : '見せ合いでは決着がつかない。取っ組み合いに持ち込むか、ここで引くか。取っ組み合いは体格と体力がものを言い、負ければ深手を負う。';
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
        h('div', { class: 'sub' }, `相手の${opp.base.aggression > 0.62 ? '目は血走っている' : opp.base.aggression < 0.38 ? '様子は落ち着いている' : '出方はわからない'}。体力 ${Math.round(p.condition * 100)}%・ケガ ${Math.round(p.injury * 100)}%`),
        h(
          'div',
          { class: 'row' },
          btn('以後は気質に任せる', () => {
            this.autoJudge = true;
            done(w.aiAnswer(pr));
          }, 'small'),
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
          line('体力', `${Math.round(p.condition * 100)}%`),
        ),
        h('h3', null, '採餌期の過ごし方'),
        h(
          'div',
          { class: 'choices' },
          choice('cautious', '慎重に', '浅瀬で少しずつ食べる。太りにくいが、シャチに遭いにくい。'),
          choice('normal', 'ふつうに', 'いつもどおり沖へ出る。'),
          choice('greedy', '貪欲に', '遠くの餌場まで行く。よく太れるが、シャチに狙われやすい。ホコが大きいほど危ない。'),
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
            ? h('div', { class: 'sub' }, `体力 ${rep.conditionDelta >= 0 ? '+' : ''}${Math.round(rep.conditionDelta * 100)}% → ${Math.round(p.condition * 100)}%`)
            : null,
        notable.length ? h('h3', null, '一族の訃報') : null,
        ...notable.filter((d) => d.id !== w.playerId).slice(0, 8).map((d) => h('div', { class: 'sub' }, `${d.name}（${d.age}歳）…${causeLabel(d.cause)}`)),
        pupDeaths ? h('div', { class: 'sub' }, `一族の子${pupDeaths}頭が冬を越せなかった。`) : null,
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
      if (daughters.length === 0) {
        await this.gameOver();
        return false;
      }
      await ask<void>((done) =>
        h(
          'div',
          null,
          h('h2', null, '血は娘たちに'),
          h('div', null, `跡を継げるオスはいない。だが、${daughters.map((d) => d.name).join('、')}がその血を宿している。`),
          h('div', { style: 'margin-top:6px' }, '娘たちが息子を産み、育つのを待とう。'),
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
        box.append(this.candidateButton(c, () => done(c.id), rel));
      }
      return h('div', null, h('h2', null, '跡継ぎを選ぶ'), h('div', { class: 'sub' }, `${prev?.name ?? '当主'}の血を引くオスたち。血の濃い順。`), box);
    });
    w.choosePlayer(id, false);
    this.select(id);
    return true;
  }

  private async gameOver(): Promise<void> {
    const w = this.world;
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

const game = new Game();
if (import.meta.env.DEV) (window as unknown as { game: Game }).game = game;
