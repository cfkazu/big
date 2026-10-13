import { clear, h } from './dom';

const root = () => document.getElementById('modal-root')!;

let queue: Promise<unknown> = Promise.resolve();

/**
 * ダイアログを開き、resolve されるまで待つ。
 * 別のダイアログが開いているあいだに呼ばれたら、それが閉じてから開く（上書きして前のを宙ぶらりんにしない）。
 */
export function ask<T>(build: (done: (v: T) => void) => HTMLElement, opts: { cls?: string } = {}): Promise<T> {
  const run = queue.then(() => open(build, opts));
  queue = run.catch(() => undefined);
  return run;
}

function open<T>(build: (done: (v: T) => void) => HTMLElement, opts: { cls?: string }): Promise<T> {
  return new Promise((resolve) => {
    const r = root();
    clear(r);
    const done = (v: T) => {
      r.classList.remove('show');
      clear(r);
      resolve(v);
    };
    const box = h('div', { class: `modal win ${opts.cls ?? ''}` }, build(done));
    r.append(box);
    r.classList.add('show');
    const first = box.querySelector<HTMLButtonElement>('button.primary') ?? box.querySelector<HTMLButtonElement>('button');
    first?.focus();
  });
}

export function isModalOpen(): boolean {
  return root().classList.contains('show');
}
