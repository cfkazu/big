// 開発用：スプライトを並べて拡大表示する
import { P } from './render/palette';
import { getBubble, getIcon, getSprite, type IconId, type SpriteId } from './render/sprites';

const S = 6;
const cv = document.getElementById('c') as HTMLCanvasElement;
const W = 200;
const H = 120;
cv.width = W * S;
cv.height = H * S;
const ctx = cv.getContext('2d')!;
ctx.imageSmoothingEnabled = false;
ctx.scale(S, S);
ctx.fillStyle = P.sand1;
ctx.fillRect(0, 0, W, H);
const ids: SpriteId[] = ['male', 'maleRear', 'subadult', 'female', 'juvenile', 'pup'];
const coats = ['brown', 'gray', 'pale'] as const;
let y = 2;
for (const coat of coats) {
  let x = 2;
  for (const id of ids) {
    const sp = getSprite(id, { coat: id === 'pup' ? 'pup' : coat, collar: coat === 'gray' && id.startsWith('male'), scars: id === 'male', frame: 0, flip: false });
    ctx.drawImage(sp, x, y);
    x += sp.width + 3;
  }
  const sp = getSprite('male', { coat, collar: false, scars: false, frame: 1, flip: true });
  ctx.drawImage(sp, x, y);
  y += 22;
}
const icons: IconId[] = ['heart', 'bang', 'sweat', 'note', 'sparkle', 'anger', 'zzz', 'crown', 'arrow', 'dot', 'cross', 'plus', 'skull', 'scheme', 'dots'];
let x = 2;
for (const ic of icons) {
  ctx.drawImage(getBubble(ic), x, y);
  ctx.drawImage(getIcon(ic), x + 2, y + 12);
  x += 13;
}
(window as unknown as { __ready: boolean }).__ready = true;
