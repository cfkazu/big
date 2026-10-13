import type { Individual } from '../sim/individual';
import { bodyMass, hokoDisplay } from '../sim/individual';
import { Rng } from '../sim/rng';
import type { World, WorldEvent } from '../sim/world';
import { P, type CoatKey } from './palette';
import { getBubble, getIcon, getOutline, getSprite, spriteSize, type Grow, type IconId, type SpriteId } from './sprites';

export const VIEW_W = 384;
export const VIEW_H = 216;
const SHORE_Y = 46;

interface Actor {
  id: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  /** 配置上の居場所（演出が終わったら戻る） */
  hx: number;
  hy: number;
  flip: boolean;
  moving: boolean;
  /** 見せ合い・取っ組み合いの演出 */
  pose: 'idle' | 'rear' | 'fight';
  poseUntil: number;
  shake: number;
  bubble: { icon: IconId; until: number } | null;
  fade: number;
  dying: boolean;
  /** 演出中は配置より演出の目標位置を優先 */
  scriptUntil: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  until: number;
  born: number;
  kind: 'heart' | 'sparkle' | 'dust' | 'plus' | 'sweat' | 'splash' | 'blood';
}

interface Gauge {
  aId: number;
  bId: number;
  aLen: number;
  bLen: number;
  winnerId: number;
  start: number;
  until: number;
}

interface Timed {
  at: number;
  run: () => void;
}

/** 海と砂浜の背景を一度だけ描いておく */
function buildBackground(seed: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = VIEW_W;
  cv.height = VIEW_H;
  const ctx = cv.getContext('2d')!;
  const rng = new Rng(seed);
  const px = (x: number, y: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, 1, 1);
  };

  // 砂（乾いた砂）
  ctx.fillStyle = P.sand1;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // 砂のムラ：大きな斑と細かい粒
  for (let i = 0; i < 70; i++) {
    const cx = rng.int(0, VIEW_W);
    const cy = rng.int(SHORE_Y + 10, VIEW_H);
    const r = rng.int(6, 18);
    for (let y = -r; y <= r; y++) {
      for (let x = -r * 2; x <= r * 2; x++) {
        const d = (x * x) / 4 + y * y;
        if (d > r * r) continue;
        // 4×4 ベイヤー風のディザで境目をぼかす
        const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5][((cy + y) & 3) * 4 + ((cx + x) & 3)];
        if (bayer / 16 < 0.55 - d / (r * r) * 0.55) px(cx + x, cy + y, i % 3 === 0 ? P.skin1 : P.sand0);
      }
    }
  }
  for (let i = 0; i < 900; i++) {
    const x = rng.int(0, VIEW_W - 1);
    const y = rng.int(SHORE_Y + 8, VIEW_H - 1);
    px(x, y, rng.chance(0.5) ? P.sand2 : P.sand0);
  }
  // 濡れた砂の帯
  for (let x = 0; x < VIEW_W; x++) {
    const edge = SHORE_Y + 6 + Math.round(2 * Math.sin(x * 0.045) + Math.sin(x * 0.13));
    for (let y = SHORE_Y - 4; y < edge; y++) px(x, y, P.skin1);
    for (let y = edge; y < edge + 3; y++) if ((x + y) % 2 === 0) px(x, y, P.skin1);
  }
  // 小石と海藻、流木
  for (let i = 0; i < 40; i++) {
    const x = rng.int(4, VIEW_W - 6);
    const y = rng.int(SHORE_Y + 4, VIEW_H - 4);
    px(x, y, P.gray2);
    px(x + 1, y, P.gray1);
  }
  for (let i = 0; i < 14; i++) {
    const x = rng.int(4, VIEW_W - 12);
    const y = rng.int(SHORE_Y + 2, SHORE_Y + 16);
    for (let k = 0; k < 6; k++) px(x + k, y + (k % 3 === 0 ? 0 : 1), k % 2 ? P.green1 : P.green2);
    px(x + 2, y - 1, P.green0);
  }
  for (let i = 0; i < 3; i++) {
    const x = rng.int(20, VIEW_W - 40);
    const y = rng.int(SHORE_Y + 18, VIEW_H - 20);
    ctx.fillStyle = P.brown1;
    ctx.fillRect(x, y + 1, 18, 2);
    ctx.fillStyle = P.brown0;
    ctx.fillRect(x + 1, y, 16, 2);
    ctx.fillStyle = P.sand2;
    ctx.fillRect(x + 2, y, 13, 1);
  }
  // 岩：画面の端と下に
  const rock = (cx: number, cy: number, w: number, h: number) => {
    for (let y = -h; y <= 0; y++) {
      for (let x = -w; x <= w; x++) {
        const nx = x / w;
        const ny = y / h;
        const d = nx * nx + ny * ny * 0.9 + (rng.next() - 0.5) * 0.08;
        if (d > 1) continue;
        let c: string = P.gray2;
        if (d > 0.82) c = P.ink;
        else if (ny < -0.45 && nx < 0.3) c = P.gray1;
        else if (nx > 0.35 || ny > -0.15) c = P.gray3;
        px(cx + x, cy + y, c);
      }
    }
    // 根元の影
    for (let x = -w - 1; x <= w + 1; x++) if ((x & 1) === 0) px(cx + x, cy + 1, P.sand2);
  };
  rock(10, 120, 12, 14);
  rock(18, 212, 22, 16);
  rock(370, 132, 14, 18);
  rock(358, 214, 26, 14);
  rock(190, 218, 16, 8);
  rock(5, 70, 8, 9);
  // 浜辺の草（下端）
  for (let x = 0; x < VIEW_W; x++) {
    if (x > 40 && x < 160) continue;
    if (x > 220 && x < 330) continue;
    const h = rng.int(0, 4);
    for (let y = 0; y < h; y++) px(x, VIEW_H - 1 - y, y === h - 1 ? P.green0 : P.green1);
  }
  return cv;
}

/** 決定論的な [0,1) の値（個体 ID から配置を決める） */
function h01(n: number, salt: number): number {
  let x = Math.imul(n ^ (salt * 0x9e3779b1), 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export class Scene {
  ctx: CanvasRenderingContext2D;
  private bg: HTMLCanvasElement;
  private actors = new Map<number, Actor>();
  private particles: Particle[] = [];
  private gauges: Gauge[] = [];
  private timeline: Timed[] = [];
  private now = 0;
  /** 採餌期に実際にシャチに襲われた数だけ現れる */
  private orcas: { x: number; y: number; dir: number; targetX: number; start: number; splashed: boolean; diveUntil: number }[] = [];
  private gulls: { x: number; y: number; vx: number; phase: number }[] = [];
  selectedId: number | null = null;
  hoverId: number | null = null;

  constructor(
    public canvas: HTMLCanvasElement,
    private world: World,
  ) {
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    this.bg = buildBackground(7);
    for (let i = 0; i < 3; i++) this.gulls.push({ x: Math.random() * VIEW_W, y: 60 + Math.random() * 120, vx: 8 + Math.random() * 6, phase: Math.random() * 6 });
  }

  setWorld(w: World): void {
    this.world = w;
    this.actors.clear();
    this.particles = [];
    this.gauges = [];
    this.timeline = [];
  }

  // ───────────────────────── 配置 ─────────────────────────

  slotCenter(s: number): { x: number; y: number } {
    const n = this.world.slotHolders.length;
    const row1 = Math.ceil(n / 2);
    const inRow1 = s < row1;
    const k = inRow1 ? s : s - row1;
    const count = inRow1 ? row1 : n - row1;
    const margin = 52;
    const span = VIEW_W - margin * 2;
    const x = count === 1 ? VIEW_W / 2 : margin + (span * k) / (count - 1) + (inRow1 ? 0 : span / (count * 2) - 8);
    return { x: Math.round(x), y: inRow1 ? 98 : 160 };
  }

  private layout(): Map<number, { x: number; y: number }> {
    const w = this.world;
    const out = new Map<number, { x: number; y: number }>();
    const y = w.year;
    for (let s = 0; s < w.slotHolders.length; s++) {
      const c = this.slotCenter(s);
      const hid = w.slotHolders[s];
      if (hid != null) out.set(hid, { x: c.x, y: c.y });
      const members = w.slotFemales(s);
      // 忍び型のオスもメスのふりをして輪に入る
      const sneakers = w.living().filter((m) => m.onBeach && m.sex === 'M' && m.base.tactic === 'F' && m.slot === s && w.age(m) >= 4);
      const ring = [...members, ...sneakers].sort((a, b) => a.id - b.id);
      ring.forEach((f, i) => {
        const ang = i * 2.39996 + s;
        const r = 15 + 6 * Math.sqrt(i);
        out.set(f.id, { x: c.x + Math.cos(ang) * r * 1.3, y: c.y + Math.sin(ang) * r * 0.55 + 2 });
      });
    }
    for (const ind of w.living()) {
      if (!ind.onBeach || out.has(ind.id)) continue;
      const age = w.age(ind);
      if (age === 0) continue; // 子は母のそば（後で）
      if (ind.sex === 'M' && ind.base.tactic === 'S' && ind.slot !== null && age >= 4) {
        const c = this.slotCenter(ind.slot);
        const ang = h01(ind.id, 3) * Math.PI * 2;
        out.set(ind.id, { x: c.x + Math.cos(ang) * 34, y: c.y + Math.sin(ang) * 16 });
        continue;
      }
      if (ind.sex === 'M' && age >= 4) {
        // 周辺のオス：波打ち際と浜の端
        const lane = h01(ind.id, 1);
        out.set(ind.id, { x: 16 + h01(ind.id, 2) * (VIEW_W - 32), y: lane < 0.7 ? SHORE_Y + 12 + lane * 18 : 124 + (lane - 0.7) * 30 });
        continue;
      }
      if (age <= 3) {
        out.set(ind.id, { x: 10 + h01(ind.id, 4) * (VIEW_W - 20), y: SHORE_Y + 4 + h01(ind.id, 5) * 10 });
        continue;
      }
      // 居場所の決まっていないメス
      out.set(ind.id, { x: 40 + h01(ind.id, 6) * (VIEW_W - 80), y: 124 + h01(ind.id, 7) * 14 });
    }
    // 子は母のそば
    for (const ind of w.living()) {
      if (!ind.onBeach || w.age(ind) !== 0) continue;
      const m = out.get(ind.motherId ?? -1);
      if (m) out.set(ind.id, { x: m.x + 9, y: m.y + 3 });
      else out.set(ind.id, { x: 30 + h01(ind.id, 8) * (VIEW_W - 60), y: 190 });
    }
    void y;
    return out;
  }

  /** 1 日ぶんの出来事を受け取り、配置と演出を更新する */
  applyDay(events: WorldEvent[], dayMs: number): void {
    const w = this.world;
    const targets = this.layout();
    const t0 = this.now;
    // 前の日の演出が残っていたら捨てる（早送りで溜まらないように）
    this.timeline = [];
    this.gauges = [];
    for (const a of this.actors.values()) {
      a.pose = 'idle';
      a.bubble = null;
    }
    // 退場・死亡
    for (const [id, a] of this.actors) {
      const ind = w.get(id);
      if (!ind || !ind.alive || !ind.onBeach) {
        if (!a.dying) {
          a.dying = true;
          if (ind && !ind.alive) this.burst(a.x, a.y - 4, 'sweat', 2);
          // 海へ帰る個体は波打ち際へ
          if (ind && ind.alive) {
            a.tx = a.hx = a.x;
            a.ty = a.hy = SHORE_Y - 6;
          }
        }
      }
    }
    // 新顔
    for (const [id, pos] of targets) {
      let a = this.actors.get(id);
      if (!a) {
        const ind = w.get(id)!;
        const fromSea = w.day <= 1 && w.age(ind) > 0;
        a = {
          id,
          x: fromSea ? pos.x : pos.x,
          y: fromSea ? SHORE_Y - 4 : pos.y,
          tx: pos.x,
          ty: pos.y,
          hx: pos.x,
          hy: pos.y,
          flip: h01(id, 9) < 0.5,
          moving: false,
          pose: 'idle',
          poseUntil: 0,
          shake: 0,
          bubble: null,
          fade: 1,
          dying: false,
          scriptUntil: 0,
        };
        this.actors.set(id, a);
      }
      a.hx = pos.x;
      a.hy = pos.y;
      if (a.scriptUntil <= this.now) {
        a.tx = pos.x;
        a.ty = pos.y;
      }
    }

    // 演出の予定を組む
    const spread = (i: number, n: number) => t0 + (dayMs * 0.55 * (i + Math.random() * 0.6)) / Math.max(1, n);
    const contests = events.filter((e) => e.kind === 'display' || e.kind === 'fight');
    contests.forEach((e, i) => {
      if (e.kind !== 'display' && e.kind !== 'fight') return;
      const at = spread(i, contests.length);
      this.timeline.push({ at, run: () => this.playContest(e.aId, e.bId, e.winnerId, e.kind as 'display' | 'fight', dayMs) });
    });
    const others = events.filter((e) => e.kind !== 'display' && e.kind !== 'fight');
    others.forEach((e, i) => {
      const at = t0 + dayMs * 0.3 + (dayMs * 0.6 * i) / Math.max(1, others.length);
      this.timeline.push({ at, run: () => this.playEvent(e) });
    });

    // つぶやきの吹き出し（今日つぶやいた個体）
    const thinkers = w.living().filter((i) => i.thought && i.thought.year === w.year && i.thought.day === w.day - 1 && i.onBeach);
    thinkers.sort((a, b) => this.bubblePriority(b) - this.bubblePriority(a));
    thinkers.slice(0, 7).forEach((ind, i) => {
      const at = t0 + (dayMs * 0.8 * i) / 7 + Math.random() * 200;
      this.timeline.push({
        at,
        run: () => {
          const a = this.actors.get(ind.id);
          if (a && ind.thought) a.bubble = { icon: moodIcon(ind.thought.mood), until: this.now + Math.max(1400, dayMs * 1.1) };
        },
      });
    });

  }

  /** 採餌期のシャチの襲撃を、沖の背びれと水しぶきで見せる */
  playOrcaAttacks(n: number): void {
    for (let i = 0; i < n; i++) {
      const fromLeft = Math.random() < 0.5;
      this.orcas.push({
        x: fromLeft ? -12 : VIEW_W + 12,
        y: 10 + Math.random() * 24,
        dir: fromLeft ? 1 : -1,
        targetX: 60 + Math.random() * (VIEW_W - 120),
        start: this.now + i * 450,
        splashed: false,
        diveUntil: 0,
      });
    }
  }

  private bubblePriority(ind: Individual): number {
    const w = this.world;
    if (ind.id === w.playerId) return 100;
    if (w.isPlayerHaremFemale(ind)) return 50;
    if (ind.dynasty > 0) return 30;
    if (ind.id === this.selectedId) return 80;
    return Math.random() * 10;
  }

  private playContest(aId: number, bId: number, winnerId: number, kind: 'display' | 'fight', dayMs: number): void {
    const a = this.actors.get(aId);
    const b = this.actors.get(bId);
    if (!a || !b) return;
    const dur = Math.min(1600, Math.max(700, dayMs * 0.7));
    // 挑戦者が相手の前まで進み出る
    const side = a.x < b.x ? -1 : 1;
    a.tx = b.x + side * 22;
    a.ty = b.y;
    a.scriptUntil = this.now + dur;
    b.scriptUntil = this.now + dur;
    a.flip = side < 0;
    b.flip = side > 0;
    this.timeline.push({
      at: this.now + dur * 0.3,
      run: () => {
        a.pose = 'rear';
        b.pose = 'rear';
        a.poseUntil = b.poseUntil = this.now + dur * 0.55;
        const ia = this.world.get(aId);
        const ib = this.world.get(bId);
        if (ia && ib) {
          const y = this.world.year;
          this.gauges.push({ aId, bId, aLen: hokoDisplay(ia, y), bLen: hokoDisplay(ib, y), winnerId, start: this.now, until: this.now + dur * 0.6 });
        }
      },
    });
    if (kind === 'fight') {
      this.timeline.push({
        at: this.now + dur * 0.65,
        run: () => {
          a.pose = b.pose = 'fight';
          a.poseUntil = b.poseUntil = this.now + dur * 0.4;
          a.shake = b.shake = this.now + dur * 0.4;
          this.burst((a.x + b.x) / 2, a.y - 3, 'dust', 10);
        },
      });
    }
    this.timeline.push({
      at: this.now + dur,
      run: () => {
        const loser = winnerId === aId ? b : a;
        const winner = winnerId === aId ? a : b;
        loser.bubble = { icon: 'sweat', until: this.now + 1200 };
        winner.bubble = { icon: kind === 'fight' ? 'anger' : 'note', until: this.now + 1000 };
      },
    });
  }

  private playEvent(e: WorldEvent): void {
    switch (e.kind) {
      case 'mate': {
        const m = this.actors.get(e.maleId);
        const f = this.actors.get(e.femaleId);
        if (!m || !f) return;
        m.tx = f.x + (m.x < f.x ? -10 : 10);
        m.ty = f.y - 1;
        m.scriptUntil = this.now + 900;
        this.burst(f.x, f.y - 8, 'heart', e.how === 'holder' ? 2 : 1);
        if (e.how === 'sneaker' || e.how === 'satellite') m.bubble = { icon: 'scheme', until: this.now + 1200 };
        break;
      }
      case 'groom': {
        const f = this.actors.get(e.femaleId);
        const m = this.actors.get(e.maleId);
        if (!f || !m) return;
        f.tx = m.x + (f.x < m.x ? -12 : 12);
        f.ty = m.y + 2;
        f.scriptUntil = this.now + 1000;
        this.burst(m.x, m.y - 6, e.type === 'wound' ? 'plus' : 'sparkle', e.type === 'hoko' ? 3 : 2);
        break;
      }
      case 'hokoCare': {
        const f = this.actors.get(e.femaleId);
        const m = this.actors.get(e.maleId);
        if (!f || !m) return;
        f.tx = m.x + (f.x < m.x ? -12 : 12);
        f.ty = m.y + 2;
        f.scriptUntil = this.now + 1000;
        if (e.what === 'splash') this.burst(m.x, m.y - 6, 'splash', 6);
        else {
          f.bubble = { icon: 'anger', until: this.now + 1200 };
          this.burst(m.x + (f.x < m.x ? 10 : -10), m.y, 'dust', 3);
        }
        break;
      }
      case 'tend': {
        const m = this.actors.get(e.maleId);
        const f = this.actors.get(e.femaleId);
        if (!m || !f) return;
        m.tx = f.x + (m.x < f.x ? -14 : 14);
        m.ty = f.y - 1;
        m.scriptUntil = this.now + 1400;
        this.burst(f.x, f.y - 8, 'heart', 1);
        this.burst(f.x, f.y - 6, 'sparkle', 1);
        f.bubble = { icon: 'heart', until: this.now + 1500 };
        break;
      }
      case 'soothe': {
        const m = this.actors.get(e.maleId);
        if (m) m.bubble = { icon: 'note', until: this.now + 1600 };
        for (const f of this.world.slotFemales(e.slot)) {
          const a = this.actors.get(f.id);
          if (a && Math.random() < 0.5) a.bubble = { icon: 'note', until: this.now + 1200 + Math.random() * 600 };
        }
        break;
      }
      case 'birth': {
        const p = this.actors.get(e.pupId);
        if (p) this.burst(p.x, p.y - 4, 'sparkle', 3);
        break;
      }
      case 'crushed': {
        const p = this.actors.get(e.pupId);
        if (p) this.burst(p.x, p.y - 2, 'dust', 4);
        const m = this.actors.get(e.motherId);
        if (m) m.bubble = { icon: 'sweat', until: this.now + 2000 };
        break;
      }
      case 'chase': {
        const h = this.actors.get(e.holderId);
        const i = this.actors.get(e.intruderId);
        if (!h || !i) return;
        h.bubble = { icon: 'anger', until: this.now + 1200 };
        i.bubble = { icon: 'bang', until: this.now + 1200 };
        this.burst(i.x, i.y - 3, 'dust', 4);
        break;
      }
      case 'takeover': {
        const n = this.actors.get(e.newId);
        if (n) this.burst(n.x, n.y - 14, 'sparkle', 4);
        break;
      }
      case 'abandon':
      case 'move':
        break;
    }
  }

  private burst(x: number, y: number, kind: Particle['kind'], n: number): void {
    for (let i = 0; i < n; i++) {
      const water = kind === 'splash' || kind === 'blood';
      const life = kind === 'dust' ? 500 : water ? 800 : 1100;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 3,
        vx: kind === 'dust' || water ? (Math.random() - 0.5) * 30 : (Math.random() - 0.5) * 6,
        vy: kind === 'dust' ? -Math.random() * 10 : water ? -20 - Math.random() * 20 : -10 - Math.random() * 6,
        born: this.now + (water ? 0 : i * 120),
        until: this.now + (water ? 0 : i * 120) + life,
        kind,
      });
    }
  }

  // ───────────────────────── 描画 ─────────────────────────

  /** 体重を絵の大きさに：胴の長さと厚みを段階的に変える */
  private growFor(ind: Individual, id: SpriteId): Grow {
    return bodyGrow(ind, this.world.year, id);
  }

  private spriteFor(ind: Individual, a: Actor): { id: SpriteId; coat: CoatKey; collar: boolean; grow: Grow } {
    const w = this.world;
    const age = w.age(ind);
    const coat: CoatKey = age === 0 ? 'pup' : ind.base.coat;
    let id: SpriteId;
    if (age === 0) id = 'pup';
    else if (age <= 2) id = 'juvenile';
    else if (ind.sex === 'F' || ind.base.tactic === 'F') id = ind.sex === 'M' && age < 4 ? 'juvenile' : 'female';
    else if (age < 7) id = 'subadult';
    else id = a.pose === 'rear' || a.pose === 'fight' ? 'maleRear' : 'male';
    if (id === 'subadult' && (a.pose === 'rear' || a.pose === 'fight') && age >= 5) id = 'maleRear';
    return { id, coat, collar: ind.sex === 'M' && ind.base.tactic === 'S' && age >= 4, grow: this.growFor(ind, id) };
  }

  update(dtMs: number): void {
    this.now += dtMs;
    const dt = dtMs / 1000;
    // 予定の演出
    if (this.timeline.length) {
      const due = this.timeline.filter((t) => t.at <= this.now);
      this.timeline = this.timeline.filter((t) => t.at > this.now);
      for (const t of due) t.run();
    }
    for (const [id, a] of this.actors) {
      if (a.pose !== 'idle' && this.now > a.poseUntil) a.pose = 'idle';
      if (a.bubble && this.now > a.bubble.until) a.bubble = null;
      if (a.scriptUntil && this.now > a.scriptUntil) {
        a.scriptUntil = 0;
        a.tx = a.hx;
        a.ty = a.hy;
      }
      if (a.dying) {
        a.fade -= dt * 0.8;
        if (a.fade <= 0) {
          this.actors.delete(id);
          continue;
        }
      }
      const dx = a.tx - a.x;
      const dy = a.ty - a.y;
      const dist = Math.hypot(dx, dy);
      const speed = a.scriptUntil > this.now ? 46 : 24;
      if (dist > 0.6) {
        const step = Math.min(dist, speed * dt);
        a.x += (dx / dist) * step;
        a.y += (dy / dist) * step;
        a.moving = true;
        if (Math.abs(dx) > 1.5) a.flip = dx > 0;
      } else {
        a.moving = false;
      }
    }
    this.particles = this.particles.filter((p) => this.now < p.until);
    for (const p of this.particles) {
      if (this.now < p.born) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'dust') p.vy += 20 * dt;
      if (p.kind === 'splash' || p.kind === 'blood') p.vy += 60 * dt;
    }
    this.gauges = this.gauges.filter((g) => this.now < g.until);
    for (const g of this.gulls) {
      g.x += g.vx * dt;
      g.phase += dt * 6;
      if (g.x > VIEW_W + 10) {
        g.x = -10;
        g.y = 50 + Math.random() * 130;
      }
    }
    for (const o of this.orcas) {
      if (this.now < o.start) continue;
      o.x += o.dir * 70 * dt;
      if (!o.splashed && (o.dir > 0 ? o.x >= o.targetX : o.x <= o.targetX)) {
        o.splashed = true;
        o.diveUntil = this.now + 700;
        this.burst(o.x, o.y - 2, 'splash', 10);
        this.burst(o.x, o.y - 1, 'blood', 2);
      }
    }
    this.orcas = this.orcas.filter((o) => o.x > -30 && o.x < VIEW_W + 30);
  }

  draw(): void {
    const ctx = this.ctx;
    const t = this.now / 1000;
    ctx.drawImage(this.bg, 0, 0);
    this.drawSea(t);

    // 奥から手前へ
    const list = [...this.actors.values()].sort((a, b) => a.y - b.y);
    for (const a of list) {
      const ind = this.world.get(a.id);
      if (!ind) continue;
      this.drawActor(a, ind, t);
    }
    for (const g of this.gauges) this.drawGauge(g);
    for (const p of this.particles) {
      if (this.now < p.born) continue;
      const icon: IconId = p.kind === 'heart' ? 'heart' : p.kind === 'sparkle' ? 'sparkle' : p.kind === 'plus' ? 'plus' : p.kind === 'sweat' ? 'sweat' : 'dot';
      if (p.kind === 'dust') {
        ctx.fillStyle = (p.until - this.now) > 250 ? P.sand0 : P.gray0;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
      } else if (p.kind === 'splash' || p.kind === 'blood') {
        ctx.fillStyle = p.kind === 'blood' ? P.red0 : (p.until - this.now) > 300 ? P.white : P.cyan;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
      } else {
        const ic = getIcon(icon);
        ctx.drawImage(ic, Math.round(p.x - ic.width / 2), Math.round(p.y));
      }
    }
    // 吹き出しと印は最前面
    for (const a of list) {
      const ind = this.world.get(a.id);
      if (!ind || a.dying) continue;
      this.drawMarkers(a, ind, t);
    }
    for (const g of this.gulls) this.drawGull(g);
  }

  private drawSea(t: number): void {
    const ctx = this.ctx;
    // 深さの帯
    const bands: [number, string][] = [
      [0, P.blue0],
      [14, P.blue0],
      [24, P.blue1],
    ];
    for (let x = 0; x < VIEW_W; x++) {
      const shore = SHORE_Y + Math.round(2.5 * Math.sin(x * 0.045 + t * 0.9) + 1.2 * Math.sin(x * 0.12 - t * 1.3));
      for (const [y0, c] of bands) {
        ctx.fillStyle = c;
        ctx.fillRect(x, y0, 1, shore - y0);
      }
      // 深みとの境目をディザで
      for (let y = 12; y < 16; y++) if ((x + y) % 2 === 0) {
        ctx.fillStyle = P.blue1;
        ctx.fillRect(x, y + 10, 1, 1);
      }
      // 波頭の泡
      ctx.fillStyle = P.white;
      ctx.fillRect(x, shore - 1, 1, 1);
      if ((x + Math.floor(t * 4)) % 5 === 0) ctx.fillRect(x, shore, 1, 1);
      ctx.fillStyle = P.cyan;
      ctx.fillRect(x, shore - 2, 1, 1);
    }
    // きらめき
    for (let i = 0; i < 26; i++) {
      const x = (i * 53 + Math.floor(t * 10 * (1 + (i % 3)))) % VIEW_W;
      const y = 3 + ((i * 17) % 34);
      const on = Math.sin(t * 3 + i) > 0.3;
      if (!on) continue;
      ctx.fillStyle = y < 20 ? P.blue1 : P.cyan;
      ctx.fillRect(x, y, 3, 1);
    }
    // シャチの背びれ（潜っている間は見えない）
    for (const o of this.orcas) {
      if (this.now < o.start || this.now < o.diveUntil) continue;
      const ox = Math.round(o.x);
      const oy = Math.round(o.y + Math.sin(t * 3 + o.targetX) * 1);
      ctx.fillStyle = P.ink;
      for (let k = 0; k < 7; k++) ctx.fillRect(ox - Math.round(k * 0.5 * o.dir), oy - k, 2, 1);
      ctx.fillRect(ox - 4, oy, 9, 1);
      ctx.fillStyle = P.white;
      ctx.fillRect(ox + (o.dir > 0 ? 3 : -4), oy, 2, 1);
      ctx.fillStyle = P.cyan;
      ctx.fillRect(ox - 6 * o.dir, oy + 1, 3, 1);
    }
  }

  private drawActor(a: Actor, ind: Individual, t: number): void {
    const ctx = this.ctx;
    const { id, coat, collar, grow } = this.spriteFor(ind, a);
    const frame: 0 | 1 = a.moving ? (Math.floor(t * 5 + a.id) % 2 as 0 | 1) : 0;
    const sp = getSprite(id, {
      coat,
      collar,
      scars: ind.sex === 'M' && this.world.age(ind) >= 8 && ind.base.tactic === 'R' && (ind.lifetime.fightsWon > 1 || ind.injury > 0.2),
      frame,
      flip: a.flip,
      grow,
    });
    let x = Math.round(a.x - sp.width / 2);
    const y = Math.round(a.y - sp.height + 2);
    if (a.shake > this.now) x += Math.round(Math.sin(this.now / 25) * 1.5);
    // 呼吸：止まっている間、ときどき 1px 沈む
    const breathe = !a.moving && Math.sin(t * 1.6 + a.id) > 0.85 ? 1 : 0;
    // 影
    ctx.fillStyle = P.sand2;
    if (a.fade > 0.5) {
      const sw = sp.width - 4;
      for (let k = 0; k < sw; k++) if ((k & 1) === 0 || k > 2 && k < sw - 3) ctx.fillRect(x + 2 + k, y + sp.height - 1, 1, 1);
    }
    ctx.globalAlpha = Math.max(0, Math.min(1, a.fade));
    if (a.fade < 1) {
      // 消えていく個体はディザで間引く
      ctx.globalAlpha = 1;
      if (Math.floor(this.now / 60) % 3 === 0 && a.fade < 0.6) return;
    }
    // 自分は金、選択中は白、ホバーは灰の縁取り
    const isPlayer = a.id === this.world.playerId;
    const ring = isPlayer ? (Math.sin(t * 5) > -0.4 ? P.gold1 : P.gold0) : a.id === this.selectedId ? P.white : a.id === this.hoverId ? P.gray0 : null;
    if (ring) ctx.drawImage(getOutline(sp, ring), x - 1, y + breathe - 1);
    ctx.drawImage(sp, x, y + breathe);
    ctx.globalAlpha = 1;
  }

  private drawMarkers(a: Actor, ind: Individual, t: number): void {
    const ctx = this.ctx;
    const w = this.world;
    const { id, grow } = this.spriteFor(ind, a);
    const { h: sh } = spriteSize(id, grow);
    const top = Math.round(a.y - sh + 1);
    const cx = Math.round(a.x);
    let markY = top - 2;
    if (a.id === w.playerId) {
      const ic = getIcon('arrow');
      const bob = Math.round(Math.sin(t * 4) * 1.5);
      ctx.drawImage(ic, cx - 3, top - 8 + bob);
      markY = top - 10;
    } else if (w.slotOf(ind) !== null) {
      const ic = getIcon('crown');
      ctx.drawImage(ic, cx - 2, top - 5);
      markY = top - 7;
    } else if (ind.dynasty > 0 && w.age(ind) > 0) {
      ctx.fillStyle = P.ink;
      ctx.fillRect(cx - 1, top - 4, 3, 3);
      ctx.fillStyle = P.red1;
      ctx.fillRect(cx, top - 3, 1, 1);
      markY = top - 5;
    }
    if (a.bubble) {
      const b = getBubble(a.bubble.icon);
      ctx.drawImage(b, cx - 5 + (a.flip ? 3 : -3), markY - b.height);
    }
  }

  private drawGauge(g: Gauge): void {
    const ctx = this.ctx;
    const a = this.actors.get(g.aId);
    const b = this.actors.get(g.bId);
    if (!a || !b) return;
    const prog = Math.min(1, (this.now - g.start) / 500);
    // 頭上の小さな物差し：ホコの長さを比べる
    const draw = (act: Actor, len: number, win: boolean) => {
      const full = 16;
      const h = Math.max(1, Math.round(Math.min(1, len / 64) * full * prog));
      const x = Math.round(act.x) + (act.flip ? 6 : -8);
      const base = Math.round(act.y) - 20;
      ctx.fillStyle = P.ink;
      ctx.fillRect(x - 1, base - full - 1, 4, full + 3);
      ctx.fillStyle = P.navy0;
      ctx.fillRect(x, base - full, 2, full + 1);
      ctx.fillStyle = prog >= 1 ? (win ? P.gold1 : P.gray1) : P.orange1;
      ctx.fillRect(x, base + 1 - h, 2, h);
      for (let k = 4; k < full; k += 4) {
        ctx.fillStyle = P.ink;
        ctx.fillRect(x + 1, base - k, 1, 1);
      }
      if (prog >= 1 && win) {
        const ic = getIcon('crown');
        ctx.drawImage(ic, x - 1, base - full - 6);
      }
    };
    draw(a, g.aLen, g.winnerId === g.aId);
    draw(b, g.bLen, g.winnerId === g.bId);
  }

  private drawGull(g: { x: number; y: number; phase: number }): void {
    const ctx = this.ctx;
    const x = Math.round(g.x);
    const y = Math.round(g.y);
    const up = Math.sin(g.phase) > 0;
    ctx.fillStyle = P.white;
    ctx.fillRect(x, y, 1, 1);
    ctx.fillRect(x - 1, y + (up ? -1 : 1), 1, 1);
    ctx.fillRect(x - 2, y + (up ? -2 : 1), 1, 1);
    ctx.fillRect(x + 1, y + (up ? -1 : 1), 1, 1);
    ctx.fillRect(x + 2, y + (up ? -2 : 1), 1, 1);
    // 影
    ctx.fillStyle = P.sand2;
    ctx.fillRect(x - 1, y + 22, 3, 1);
  }

  // ───────────────────────── 当たり判定 ─────────────────────────

  pick(vx: number, vy: number): number | null {
    let best: number | null = null;
    let bestY = -Infinity;
    for (const a of this.actors.values()) {
      if (a.dying) continue;
      const ind = this.world.get(a.id);
      if (!ind) continue;
      const { id, grow } = this.spriteFor(ind, a);
      const { w, h } = spriteSize(id, grow);
      const x0 = a.x - w / 2;
      const y0 = a.y - h + 2;
      if (vx >= x0 && vx < x0 + w && vy >= y0 && vy < a.y + 2 && a.y > bestY) {
        best = a.id;
        bestY = a.y;
      }
    }
    return best;
  }

  actorPos(id: number): { x: number; y: number } | null {
    const a = this.actors.get(id);
    return a ? { x: a.x, y: a.y } : null;
  }

  get busy(): boolean {
    return this.timeline.length > 0;
  }
}

function moodIcon(m: Individual['thought'] extends infer T ? (T extends { mood: infer M } ? M : never) : never): IconId {
  switch (m) {
    case 'happy': return 'note';
    case 'love': return 'heart';
    case 'sad': return 'sweat';
    case 'angry': return 'anger';
    case 'scheme': return 'scheme';
    default: return 'dots';
  }
}

/** 体重に応じて、スプライトの胴を何列・何行のばすか */
export function bodyGrow(ind: Individual, year: number, id: SpriteId): Grow {
  const m = bodyMass(ind, year);
  const tiers = (edges: number[], out: Grow[]): Grow => {
    for (let i = 0; i < edges.length; i++) if (m < edges[i]) return out[i];
    return out[out.length - 1];
  };
  switch (id) {
    case 'male':
    case 'maleRear':
      return tiers([1150, 1350, 1600, 1850, 2100], [
        { cols: -3, rows: -1 }, { cols: -1, rows: 0 }, { cols: 0, rows: 0 }, { cols: 2, rows: 0 }, { cols: 4, rows: 1 }, { cols: 6, rows: 2 },
      ]);
    case 'subadult':
      return tiers([600, 850, 1100], [{ cols: -2, rows: 0 }, { cols: 0, rows: 0 }, { cols: 2, rows: 0 }, { cols: 3, rows: 1 }]);
    case 'female':
      return tiers([470, 560, 660, 800], [{ cols: -1, rows: 0 }, { cols: 0, rows: 0 }, { cols: 1, rows: 0 }, { cols: 2, rows: 0 }, { cols: 3, rows: 1 }]);
    default:
      return { cols: 0, rows: 0 };
  }
}
