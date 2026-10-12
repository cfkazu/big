// 開発用：ダイアログを自動でさばきながら N 年遊ぶスモークテスト
// 使い方: npm run dev を起動したまま node scripts/autoplay.mjs <スクショ出力先> [年数]
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const out = process.argv[2] ?? ".";
const YEARS = +(process.argv[3] ?? 10);
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('page error:', e.message, e.stack));
await page.goto('http://localhost:5173/');
await page.waitForTimeout(500);
await page.click('text=はじめる');
await page.waitForFunction(() => document.querySelector('#modal-root').textContent.includes('初代を選ぶ'), null, { timeout: 20000 });
await page.locator('#modal-root .choice').first().click();
await page.click('text=浜へ');
await page.click('text=判断：自分で');
const seen = new Set();
let lastYear = -1;
for (let iter = 0; iter < 5000; iter++) {
  const st = await page.evaluate(() => ({ year: window.game.world.displayYear(), mode: window.game.mode, modal: document.querySelector('#modal-root').classList.contains('show'), text: document.querySelector('#modal-root').textContent }));
  if (st.year !== lastYear) { lastYear = st.year; }
  if (st.year > YEARS) break;
  if (st.modal) {
    const key = st.text.slice(0, 8);
    if (!seen.has(key)) { seen.add(key); console.log(`y${st.year} modal: ${st.text.slice(0, 90)}`); await page.screenshot({ path: `${out}/m-${seen.size}.png` }); }
    if (st.text.includes('血は絶えた')) { console.log('GAME OVER'); break; }
    if (st.text.includes('採餌期の過ごし方')) await page.locator('#modal-root .choice').nth(1).click();
    else if (st.text.includes('跡継ぎを選ぶ') && await page.locator('#modal-root .choice').count()) await page.locator('#modal-root .choice').first().click();
    else await page.locator('#modal-root button.primary, #modal-root button').first().click();
    await page.waitForTimeout(100);
    continue;
  }
  if (st.mode === 'season') {
    await page.evaluate(() => { void window.game.stepDay(); });
    await page.waitForTimeout(15);
  } else await page.waitForTimeout(50);
}
const info = await page.evaluate(() => { const g = window.game; const w = g.world; return { year: w.displayYear(), gen: w.generation, player: w.player?.name, age: w.player ? w.age(w.player) : null, share: w.history.at(-1)?.dynastyShare, dyn: w.history.at(-1)?.dynastyCount }; });
console.log(info);
await page.locator('text=血統').first().click().catch(() => {});
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/final.png` });
await browser.close();
