// 1 枚の HTML にまとめた配布版を作る: node scripts/build-artifact.mjs <出力パス>
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const out = process.argv[2] ?? 'dist-artifact/hamatodo.html';
execSync('npx vite build --mode artifact', { stdio: 'inherit' });
const dir = 'dist-artifact/assets';
const files = readdirSync(dir);
const js = readFileSync(join(dir, files.find((f) => f.endsWith('.js'))), 'utf8');
const css = readFileSync(join(dir, files.find((f) => f.endsWith('.css'))), 'utf8');
const body = readFileSync('index.html', 'utf8').match(/<body>([\s\S]*?)<script/)[1];
const html = `<title>ハマトド</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DotGothic16&display=swap">
<style>${css}</style>
${body.trim()}
<script type="module">${js.replace(/<\/script/g, '<\\/script')}</script>
`;
writeFileSync(out, html);
console.log('wrote', out, (html.length / 1024).toFixed(0) + 'KB');
