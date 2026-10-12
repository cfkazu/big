import { setCustomLines, type CustomLine, type ThoughtKey } from '../sim/thoughts';
import type { Tag } from '../sim/thought-variants';

/**
 * セリフ帳で足されたセリフの置き場。
 * 公開ページでは artifact の db（"lines" コレクション）に入れ、届いた変更をすぐ setCustomLines に流す。
 * db が使えないとき（手元の開発サーバーなど）はブラウザの localStorage に置く。
 */

export type StoreMode = 'pending' | 'db' | 'local';

interface Db {
  collection(path: string): {
    add(data: Record<string, unknown>): Promise<unknown>;
    onSnapshot(next: (snap: { docs: { id: string; data(): Record<string, unknown> | undefined }[] }) => void, error?: (e: { code: string }) => void): () => void;
  };
  doc(path: string): { delete(): Promise<void> };
}

const LOCAL_KEY = 'hamatodo-lines';
let mode: StoreMode = 'pending';
let db: Db | null = null;
let local: CustomLine[] = [];
const listeners = new Set<() => void>();

function notify(): void {
  for (const fn of listeners) fn();
}

export function storeMode(): StoreMode {
  return mode;
}

/** 変わったら呼ぶ。戻り値で解除。 */
export function onLinesChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function readLocal(): CustomLine[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const v = raw ? (JSON.parse(raw) as CustomLine[]) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function writeLocal(): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(local));
  } catch {
    /* 保存できなくても、この回のあいだは使える */
  }
}

function goLocal(): void {
  mode = 'local';
  db = null;
  local = readLocal();
  setCustomLines(local);
  notify();
}

function toLine(id: string, d: Record<string, unknown> | undefined): (CustomLine & { at: number }) | null {
  if (!d || typeof d.key !== 'string' || typeof d.text !== 'string') return null;
  return { id, key: d.key as ThoughtKey, tag: (typeof d.tag === 'string' ? d.tag : '') as Tag | '', text: d.text.slice(0, 120), at: typeof d.at === 'number' ? d.at : 0 };
}

/** 起動時に一度だけ呼ぶ。db の返事は待たずに戻る。 */
export function initLineStore(): void {
  const claude = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
  if (!claude?.use) {
    goLocal();
    return;
  }
  claude
    .use('db')
    .then((d) => {
      if (!d) return goLocal();
      db = d as Db;
      mode = 'db';
      notify();
      db.collection('lines').onSnapshot(
        (snap) => {
          const lines = snap.docs
            .map((doc) => toLine(doc.id, doc.data()))
            .filter((l): l is CustomLine & { at: number } => l !== null)
            .sort((a, b) => a.at - b.at);
          setCustomLines(lines);
          notify();
        },
        () => goLocal(),
      );
    })
    .catch(() => goLocal());
}

export async function addLine(key: ThoughtKey, tag: Tag | '', text: string): Promise<void> {
  if (mode === 'db' && db) {
    await db.collection('lines').add({ key, tag, text, at: Date.now() });
    return; // 反映は onSnapshot から届く
  }
  local.push({ id: `l${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`, key, tag, text });
  writeLocal();
  setCustomLines(local);
  notify();
}

export async function removeLine(id: string): Promise<void> {
  if (mode === 'db' && db) {
    await db.doc(`lines/${id}`).delete();
    return;
  }
  local = local.filter((l) => l.id !== id);
  writeLocal();
  setCustomLines(local);
  notify();
}
