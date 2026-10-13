import { P } from '../render/palette';
import { bodyGrow } from '../render/scene';
import { getIcon, getSprite, spriteSize, type IconId, type SpriteId } from '../render/sprites';
import { hokoDisplay, type Individual } from '../sim/individual';
import type { World, WorldEvent } from '../sim/world';
import { btn, h } from './dom';
import { ask } from './modal';

/**
 * あなたの勝負を、短いカットインで見せる。
 * にらみ合い（ホコを掲げて比べる）→ 見せ合いで決まればそこで終わり／決まらなければ取っ組み合い（三度ぶつかる）→ 結果。
 * 中身は勝負の結果（WorldEvent）をなぞるだけで、勝ち負けはここでは決めない。
 */

const W = 192;
const H = 84;
const GROUND = 70;
/** 個体は 2 倍で描く */
const Z = 2;

type Contest = Extract<WorldEvent, { kind: 'display' | 'fight' }>;

interface Fighter {
  ind: Individual;
  x: number;
  y: number;
  /** 右を向いているか */
  facingRight: boolean;
  hoko: number;
  rear: boolean;
  down: boolean;
  icon: IconId | null;
}

interface Dust {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

function spriteIdOf(ind: Individual, world: World, rear: boolean): SpriteId {
  const age = world.age(ind);
  if (ind.sex === 'F' || ind.base.tactic === 'F') return age < 4 ? 'juvenile' : 'female';
  if (age < 7) return rear && age >= 5 ? 'maleRear' : 'subadult';
  return rear ? 'maleRear' : 'male';
}

/** 勝負ひとつ分のカットイン。speed は時間の速さ（1/2/4）で、速いほど短くなる。 */
export function playBattle(world: World, e: Contest, speed: number): Promise<void> {
  const pid = world.playerId;
  const me = world.get(pid)!;
  const opp = world.get(e.aId === pid ? e.bId : e.aId)!;
  const iWon = e.winnerId === pid;
  const fight = e.kind === 'fight';
  const withdrew = e.kind === 'display' && !!e.withdrew;
  const scale = speed >= 4 ? 0.55 : speed >= 2 ? 0.75 : 1;
  // 場面ごとの時刻（ms）
  const T = {
    enter: 450 * scale,
    rear: 1350 * scale,
    clash: fight ? 2950 * scale : 1350 * scale,
    end: (fight ? 3650 : 2150) * scale,
  };
  const y = world.year;
  const left: Fighter = { ind: me, x: -30, y: GROUND, facingRight: true, hoko: hokoDisplay(me, y), rear: false, down: false, icon: null };
  const right: Fighter = { ind: opp, x: W + 30, y: GROUND, facingRight: false, hoko: world.perceivedHoko(me, opp), rear: false, down: false, icon: null };
  const winner = iWon ? left : right;
  const loser = iWon ? right : left;
  const homeL = 50;
  const homeR = W - 50;

  return ask<void>((done) => {
    const cv = h('canvas', { class: 'battle-cv', width: W, height: H }) as HTMLCanvasElement;
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const pop = h('div', { class: 'battle-pop' });
    const banner = h('div', { class: 'battle-banner' });
    const stage = h('div', { class: 'battle-stage' }, cv, pop, banner);
    const label = (f: Fighter, mine: boolean) =>
      h('div', { class: `battle-name ${mine ? 'me' : ''}` }, mine ? `${f.ind.name}（あなた）` : f.ind.name, h('span', { class: 'sub' }, ` ${mine ? '' : '推定'}${f.hoko.toFixed(1)}cm`));
    const title = fight ? '取っ組み合い！' : withdrew ? 'にらみ合い' : '見せ合い';
    const skip = btn('とばす', () => finish(), 'small');
    const root = h(
      'div',
      { class: 'battle' },
      h('div', { class: 'battle-head' }, label(left, true), h('span', { class: 'battle-title' }, title), label(right, false)),
      stage,
      h('div', { class: 'row' }, skip),
    );

    const dust: Dust[] = [];
    let start = performance.now();
    let raf = 0;
    let closed = false;
    let shakeUntil = 0;
    let flashUntil = 0;
    let lastClash = -1;
    let ended = false;

    const finish = () => {
      if (closed) return;
      if (!ended) {
        // まず最後の場面まで飛ばす。もう一度押せば閉じる。
        start = performance.now() - T.end;
        return;
      }
      closed = true;
      cancelAnimationFrame(raf);
      done();
    };
    stage.addEventListener('click', finish);

    const burst = (x: number, yy: number, n: number) => {
      for (let i = 0; i < n; i++) {
        const a = Math.PI * (0.15 + Math.random() * 0.7);
        const v = 20 + Math.random() * 45;
        dust.push({ x, y: yy, vx: Math.cos(a) * v * (Math.random() < 0.5 ? -1 : 1), vy: -Math.sin(a) * v, life: 0.5 + Math.random() * 0.4, color: Math.random() < 0.5 ? P.sand0 : P.sand2 });
      }
    };
    const say = (text: string) => {
      pop.textContent = text;
      pop.classList.remove('show');
      void pop.offsetWidth;
      pop.classList.add('show');
    };

    const drawFighter = (f: Fighter, t: number) => {
      const id = spriteIdOf(f.ind, world, f.rear && !f.down);
      const grow = bodyGrow(f.ind, y, id);
      const frame = (Math.floor(t / 160) % 2) as 0 | 1;
      const sp = getSprite(id, { coat: f.ind.base.coat, collar: f.ind.sex === 'M' && f.ind.base.tactic === 'S', scars: false, frame: f.down ? 0 : frame, flip: f.facingRight, grow });
      const { w: sw } = spriteSize(id, grow);
      const x = Math.round(f.x - (sw * Z) / 2);
      const top = Math.round(f.y - sp.height * Z + (f.down ? 6 : 0));
      // 影
      ctx.fillStyle = P.sand2;
      ctx.fillRect(x + 4, Math.round(f.y), sw * Z - 8, 2);
      ctx.save();
      if (f.down) ctx.globalAlpha = 0.85;
      ctx.drawImage(sp, x, top, sp.width * Z, sp.height * Z);
      ctx.restore();
      if (f.icon) {
        const ic = getIcon(f.icon);
        ctx.drawImage(ic, Math.round(f.x - ic.width), top - ic.height * Z - 2, ic.width * Z, ic.height * Z);
      }
      // ホコを掲げているあいだは、大きさのゲージ
      if (f.rear && t >= T.enter && t < T.rear + 300 * scale) {
        const maxCm = Math.max(left.hoko, right.hoko, 1);
        const grow01 = Math.min(1, (t - T.enter) / (500 * scale));
        const len = Math.round((f.hoko / maxCm) * 34 * grow01);
        const gx = Math.round(f.x - 17);
        const gy = GROUND + 5;
        ctx.fillStyle = P.ink;
        ctx.fillRect(gx - 1, gy - 1, 36, 5);
        ctx.fillStyle = P.gray3;
        ctx.fillRect(gx, gy, 34, 3);
        ctx.fillStyle = f === left ? P.gold0 : P.red1;
        ctx.fillRect(gx, gy, len, 3);
      }
    };

    const backdrop = () => {
      // 空と海と浜
      ctx.fillStyle = P.blue0;
      ctx.fillRect(0, 0, W, 10);
      ctx.fillStyle = P.blue1;
      ctx.fillRect(0, 10, W, 8);
      ctx.fillStyle = P.white;
      for (let x = 0; x < W; x += 6) ctx.fillRect(x + ((Math.floor(performance.now() / 300) + x) % 3), 17, 3, 1);
      ctx.fillStyle = P.sand1;
      ctx.fillRect(0, 18, W, H - 18);
      ctx.fillStyle = P.sand0;
      for (let i = 0; i < 60; i++) ctx.fillRect((i * 53) % W, 28 + ((i * 29) % (H - 30)), 1, 1);
      ctx.fillStyle = P.sand2;
      for (let i = 0; i < 40; i++) ctx.fillRect((i * 71 + 13) % W, 30 + ((i * 17) % (H - 32)), 1, 1);
    };

    const step = (now: number) => {
      const t = now - start;
      // 入場
      const enterK = Math.min(1, t / T.enter);
      const ease = 1 - (1 - enterK) * (1 - enterK);
      if (t < T.rear) {
        left.x = -30 + (homeL + 30) * ease;
        right.x = W + 30 - (W + 30 - homeR) * ease;
      }
      // にらみ合い：ホコを掲げる
      left.rear = right.rear = t >= T.enter && t < T.rear + (fight ? 1e9 : 0);
      if (t >= T.enter && t < T.rear) {
        left.icon = right.icon = Math.floor(t / 250) % 2 ? 'bang' : null;
      }
      if (fight && t >= T.rear && t < T.clash) {
        // 三度ぶつかる
        const per = (T.clash - T.rear) / 3;
        const k = Math.floor((t - T.rear) / per);
        const u = ((t - T.rear) % per) / per;
        const lunge = u < 0.5 ? u * 2 : 2 - u * 2;
        const gap = 44;
        left.x = homeL + (W / 2 - gap / 2 - homeL) * lunge;
        right.x = homeR - (homeR - (W / 2 + gap / 2)) * lunge;
        left.icon = right.icon = 'anger';
        if (k !== lastClash && u >= 0.45) {
          lastClash = k;
          burst(W / 2, GROUND - 4, 10);
          shakeUntil = now + 140;
          flashUntil = now + 70;
          say(['ドスン！', 'バチーン！', 'ドドッ！'][k % 3]);
        }
      }
      // 決着
      if (t >= T.clash) {
        const k = Math.min(1, (t - T.clash) / (500 * scale));
        winner.rear = true;
        winner.icon = fight ? 'anger' : 'note';
        loser.rear = false;
        loser.icon = 'sweat';
        if (fight) {
          loser.down = true;
          const home = loser === left ? homeL - 18 : homeR + 18;
          const from = loser === left ? homeL : homeR;
          loser.x = from + (home - from) * k;
          winner.x = winner === left ? homeL + 6 * k : homeR - 6 * k;
        } else {
          // 見せ合いの負け（身を引く）は、すごすご下がる
          loser.facingRight = loser === right;
          const from = loser === left ? homeL : homeR;
          const to = loser === left ? -30 : W + 30;
          loser.x = from + (to - from) * k * k;
        }
        if (!banner.textContent) {
          const how = fight ? '取っ組み合い' : '見せ合い';
          banner.textContent = withdrew ? `${opp.name}とのにらみ合いから身を引いた` : iWon ? `${how}で${opp.name}に勝った！` : `${how}で${opp.name}に負けた……`;
          banner.classList.add('show', iWon ? 'win' : 'lose');
        }
      }

      // 描く
      ctx.save();
      if (now < shakeUntil) ctx.translate(Math.round((Math.random() - 0.5) * 4), Math.round((Math.random() - 0.5) * 3));
      backdrop();
      const order = left.y <= right.y ? [left, right] : [right, left];
      for (const f of order) drawFighter(f, t);
      for (const d of dust) {
        d.x += d.vx / 60;
        d.y += d.vy / 60;
        d.vy += 120 / 60;
        d.life -= 1 / 60;
        if (d.life > 0) {
          ctx.fillStyle = d.color;
          ctx.fillRect(Math.round(d.x), Math.round(d.y), 2, 2);
        }
      }
      for (let i = dust.length - 1; i >= 0; i--) if (dust[i].life <= 0) dust.splice(i, 1);
      if (now < flashUntil) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();

      if (t >= T.end && !ended) {
        ended = true;
        skip.textContent = '閉じる';
        // 少し余韻を残して自動で閉じる
        setTimeout(() => finish(), 900 * scale);
      }
      if (!closed) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return root;
  }, { cls: 'battle-win' });
}
