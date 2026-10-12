// 開発用：スプライトを並べて拡大表示する（毛色・体格の段階・アイコン）
import { P } from './render/palette';
import { getBubble, getIcon, getSprite, type IconId, type SpriteId } from './render/sprites';

const S = 5;
const cv = document.getElementById('c') as HTMLCanvasElement;
const W = 240;
const H = 150;
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
  y += 22;
}
// 体格の段階
let x = 2;
for (const grow of [{ cols: -3, rows: -1 }, { cols: 0, rows: 0 }, { cols: 2, rows: 0 }, { cols: 4, rows: 1 }, { cols: 6, rows: 2 }]) {
  const sp = getSprite('male', { coat: 'brown', collar: false, scars: false, frame: 0, flip: false, grow });
  ctx.drawImage(sp, x, y + 20 - sp.height);
  x += sp.width + 3;
}
for (const grow of [{ cols: -1, rows: 0 }, { cols: 0, rows: 0 }, { cols: 2, rows: 0 }, { cols: 3, rows: 1 }]) {
  const sp = getSprite('female', { coat: 'gray', collar: false, scars: false, frame: 0, flip: false, grow });
  ctx.drawImage(sp, x, y + 20 - sp.height);
  x += sp.width + 3;
}
y += 26;
const icons: IconId[] = ['heart', 'bang', 'sweat', 'note', 'sparkle', 'anger', 'zzz', 'crown', 'arrow', 'dot', 'cross', 'plus', 'skull', 'scheme', 'dots'];
x = 2;
for (const ic of icons) {
  ctx.drawImage(getBubble(ic), x, y);
  ctx.drawImage(getIcon(ic), x + 2, y + 12);
  x += 13;
}
(window as unknown as { __ready: boolean }).__ready = true;
