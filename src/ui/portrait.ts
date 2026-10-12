import { P } from '../render/palette';
import { getSprite, type SpriteId } from '../render/sprites';
import type { Individual } from '../sim/individual';
import type { World } from '../sim/world';

/** 浜の小窓に個体を描く（36×24 を 2 倍表示） */
export function portrait(ind: Individual, world: World, opts: { rear?: boolean } = {}): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 36;
  cv.height = 24;
  cv.className = 'portrait';
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = P.sand1;
  ctx.fillRect(0, 0, 36, 24);
  // 砂粒
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = i % 2 ? P.sand0 : P.sand2;
    ctx.fillRect((i * 37 + ind.id * 7) % 36, 14 + ((i * 13) % 10), 1, 1);
  }
  const age = world.age(ind);
  let id: SpriteId;
  if (age === 0) id = 'pup';
  else if (age <= 2) id = 'juvenile';
  else if (ind.sex === 'F' || ind.base.tactic === 'F') id = 'female';
  else if (age < 7) id = 'subadult';
  else id = opts.rear ? 'maleRear' : 'male';
  const sp = getSprite(id, {
    coat: age === 0 ? 'pup' : ind.base.coat,
    collar: ind.sex === 'M' && ind.base.tactic === 'S' && age >= 4,
    scars: false,
    frame: 0,
    flip: true,
  });
  ctx.fillStyle = P.sand2;
  ctx.fillRect(Math.round(18 - sp.width / 2) + 2, 21, sp.width - 4, 1);
  ctx.drawImage(sp, Math.round(18 - sp.width / 2), 22 - sp.height);
  if (!ind.alive) {
    ctx.fillStyle = 'rgba(24,20,37,0.55)';
    ctx.fillRect(0, 0, 36, 24);
  }
  return cv;
}
