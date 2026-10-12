import { builtinLines, customLines, SITUATIONS, TAG_LABEL, type Situation, type SituationGroup, type ThoughtKey } from '../sim/thoughts';
import type { Tag } from '../sim/thought-variants';
import { btn, clear, h } from './dom';
import { ask } from './modal';
import { addLine, onLinesChanged, removeLine, storeMode } from './linestore';

/**
 * セリフ帳：場面ごとのセリフを眺めて、自分で足す。
 * 差し込み（自分・相手・回数）はボタンで入れる。画面では〈自分〉のように見せ、保存するときに {I} などへ戻す。
 */

const MAX_LEN = 80;
const GROUPS: SituationGroup[] = ['オス', 'メス', '子ども・冬'];
const KIND_LABEL: Record<'any' | 'brash' | 'timid', string> = { any: 'どんなときでも', brash: '強気な個体', timid: '弱気な個体' };

/** 差し込みの札：保存する形と、画面で見せる形 */
function tokens(sit: Situation): { raw: string; shown: string; hint: string }[] {
  const out = [{ raw: '{I}', shown: '〈自分〉', hint: '俺・わたし・わし など、話す個体の一人称' }];
  if (sit.other) out.push({ raw: '{other}', shown: `〈${sit.other}〉`, hint: `${sit.other}の名前` });
  if (sit.count) out.push({ raw: '{n}', shown: `〈${sit.count.label}〉`, hint: sit.count.hint });
  return out;
}

const toRaw = (text: string, sit: Situation) => tokens(sit).reduce((s, t) => s.replaceAll(t.shown, t.raw), text);

/** プレビュー用の仮の名前 */
function sample(sit: Situation, raw: string): string {
  const me = sit.group === 'メス' ? 'わたし' : sit.group === 'オス' ? '俺' : 'ぼく';
  const o = sit.other ?? '';
  const other = o === 'メス' ? 'ウミラ' : o === 'メスたち' ? 'ウミラとミナモ' : o === '子' ? 'ミナモ' : /主|ボス/.test(o) ? 'ゴンタ' : 'ドスケ';
  const n = sit.count?.label === '頭数' ? '2' : '7';
  return raw.replaceAll('{I}', me).replaceAll('{other}', other).replaceAll('{n}', n);
}

/** セリフを、差し込みの部分だけ色を変えて並べる */
function lineNodes(text: string, sit: Situation): (Node | string)[] {
  const map = new Map(tokens(sit).map((t) => [t.raw, t.shown]));
  return text.split(/(\{I\}|\{other\}|\{n\})/).map((part) => (map.has(part) ? h('span', { class: 'tok' }, map.get(part)!) : part));
}

function counts(key: ThoughtKey): { base: number; mine: number } {
  return { base: builtinLines(key).length, mine: customLines().filter((c) => c.key === key).length };
}

function storeNote(): HTMLElement {
  const m = storeMode();
  const text =
    m === 'db'
      ? 'ここで足したセリフは保存され、このゲームを開く人みんなの浜で使われる。足したその日から喋りだす。'
      : m === 'local'
        ? 'このブラウザにだけ保存される。足したその日から喋りだす。'
        : '保存先につないでいます…';
  return h('div', { class: 'sub lb-note' }, text);
}

export function openLineBook(): Promise<void> {
  return ask<void>(
    (done) => {
      const root = h('div', { class: 'linebook' });
      let current: ThoughtKey | null = null;
      // 一覧の部分だけを描き直す（入力欄はそのまま残す）
      let refreshList: () => void = () => {};
      const off = onLinesChanged(() => (current ? refreshList() : showIndex()));
      const close = () => {
        off();
        done();
      };

      const toTop = () => requestAnimationFrame(() => root.closest('.modal')?.scrollTo(0, 0));

      function showIndex(): void {
        current = null;
        clear(root);
        toTop();
        root.append(
          h('h2', null, 'セリフ帳'),
          h('div', null, '場面を選ぶと、いまあるセリフが見られて、自分のセリフを足せる。条件をつければ「大きいホコのとき」のような決まった場面で優先して喋る。'),
          storeNote(),
        );
        for (const g of GROUPS) {
          root.append(h('h3', null, g));
          const grid = h('div', { class: 'lb-grid' });
          for (const [key, sit] of Object.entries(SITUATIONS) as [ThoughtKey, Situation][]) {
            if (sit.group !== g) continue;
            const c = counts(key);
            grid.append(
              btn(h('span', { class: 'lb-sit-in' }, h('span', null, sit.label), h('span', { class: 'lb-count' }, c.mine > 0 ? `${c.base}＋${c.mine}` : `${c.base}`)), () => showSituation(key), 'small lb-sit'),
            );
          }
          root.append(grid);
        }
        root.append(h('div', { class: 'row' }, btn('閉じる', close, 'primary')));
      }

      function showSituation(key: ThoughtKey): void {
        current = key;
        const sit = SITUATIONS[key];
        const toks = tokens(sit);
        clear(root);
        toTop();

        // ── 足す ──
        let tag: Tag | '' = '';
        const status = h('div', { class: 'lb-status' });
        const preview = h('div', { class: 'thought lb-preview' });
        const ta = h('textarea', { class: 'lb-input', rows: 2, maxlength: 120, placeholder: 'ここに書く。〈自分〉などは下のボタンで入れる' }) as HTMLTextAreaElement;
        const save = btn('このセリフを足す', () => void doSave(), 'primary');

        const update = () => {
          const raw = toRaw(ta.value.trim(), sit);
          clear(preview);
          preview.append(raw ? `「${sample(sit, raw)}」` : h('span', { class: 'sub' }, '（ここに見本が出る）'));
          save.disabled = !raw || raw.length > MAX_LEN || storeMode() === 'pending';
          status.textContent = raw.length > MAX_LEN ? `長すぎる（${raw.length}/${MAX_LEN}字）` : '';
        };

        // 差し込みはひとかたまりで消えるように
        ta.addEventListener('keydown', (e) => {
          if (e.key !== 'Backspace' || ta.selectionStart !== ta.selectionEnd) return;
          const pos = ta.selectionStart;
          const t = toks.find((t) => ta.value.slice(0, pos).endsWith(t.shown));
          if (!t) return;
          e.preventDefault();
          ta.setRangeText('', pos - t.shown.length, pos, 'end');
          update();
        });
        ta.addEventListener('input', update);

        const insert = (shown: string) => {
          const s = ta.selectionStart ?? ta.value.length;
          const e = ta.selectionEnd ?? ta.value.length;
          ta.setRangeText(shown, s, e, 'end');
          update();
        };

        const chipRow = h('div', { class: 'lb-chips' });
        const drawChips = () => {
          clear(chipRow);
          for (const t of ['', ...sit.tags] as (Tag | '')[]) {
            chipRow.append(btn(t === '' ? 'どんなときでも' : TAG_LABEL[t], () => { tag = t; drawChips(); }, `small ${tag === t ? 'on' : ''}`));
          }
        };
        drawChips();

        const tokRow = h('div', { class: 'lb-chips' }, h('span', { class: 'sub' }, '差し込む：'));
        for (const t of toks) {
          const b = btn(t.shown, () => insert(t.shown), 'small lb-tok');
          b.title = t.hint;
          // 押しても入力欄のカーソルを失わない
          b.addEventListener('mousedown', (e) => e.preventDefault());
          tokRow.append(b);
        }

        async function doSave(): Promise<void> {
          const raw = toRaw(ta.value.trim(), sit).replace(/\s+/g, ' ');
          if (!raw || raw.length > MAX_LEN) return;
          save.disabled = true;
          status.textContent = '保存しています…';
          try {
            await addLine(key, tag, raw);
            ta.value = '';
            update();
            status.textContent = `足した。${tag ? `「${TAG_LABEL[tag]}」のときに` : ''}喋りだす。`;
          } catch (err) {
            const code = (err as { code?: string })?.code;
            status.textContent =
              code === 'quota_exceeded' ? 'セリフ帳がいっぱいで足せない。いくつか消してから。' : code === 'invalid_argument' ? 'このセリフは保存できなかった。' : '保存できなかった（書き込む権限がないか、つながっていない）。';
            update();
          }
        }

        // ── いまあるセリフ ──
        const list = h('div', { class: 'lb-list' });
        refreshList = () => {
          clear(list);
          const groups = new Map<string, HTMLElement[]>();
          const push = (label: string, el: HTMLElement) => groups.set(label, [...(groups.get(label) ?? []), el]);
          for (const b of builtinLines(key)) {
            const label = b.kind in KIND_LABEL ? KIND_LABEL[b.kind as keyof typeof KIND_LABEL] : TAG_LABEL[b.kind as Tag];
            push(label, h('li', null, ...lineNodes(b.text, sit)));
          }
          for (const c of customLines().filter((c) => c.key === key)) {
            let armed = false;
            const del = btn('消す', () => {
              if (!armed) {
                armed = true;
                del.textContent = '本当に消す';
                return;
              }
              del.disabled = true;
              removeLine(c.id).catch(() => {
                del.disabled = false;
                del.textContent = '消せなかった';
              });
            }, 'small lb-del');
            push(c.tag ? TAG_LABEL[c.tag] : KIND_LABEL.any, h('li', { class: 'mine' }, h('span', { class: 'tag gold' }, 'あなた'), ...lineNodes(c.text, sit), del));
          }
          // どんなとき → 強気 → 弱気 → 条件の順
          const order = [KIND_LABEL.any, KIND_LABEL.brash, KIND_LABEL.timid, ...sit.tags.map((t) => TAG_LABEL[t])];
          const labels = [...groups.keys()].sort((a, b) => (order.indexOf(a) + 99) % 99 - (order.indexOf(b) + 99) % 99);
          for (const label of labels) list.append(h('h3', null, label), h('ul', null, ...groups.get(label)!));
          update();
        };

        root.append(
          h('div', { class: 'lb-head' }, btn('← 場面の一覧', showIndex, 'small'), h('h2', null, sit.label)),
          h('div', { class: 'lb-form inset' },
            h('div', { class: 'lb-label' }, 'どんなときに言う？'),
            chipRow,
            h('div', { class: 'lb-label' }, 'セリフ'),
            ta,
            tokRow,
            h('div', { class: 'sub' }, ...toks.map((t) => `${t.shown}＝${t.hint}　`), '長さの数字（cm）は入れないのがこの浜の流儀。'),
            preview,
            h('div', { class: 'row' }, status, save),
          ),
          storeNote(),
          list,
          h('div', { class: 'row' }, btn('← 場面の一覧', showIndex, 'small'), btn('閉じる', close, 'primary')),
        );
        refreshList();
      }

      showIndex();
      return root;
    },
    { cls: 'lb-win' },
  );
}
