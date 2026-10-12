import { clear, h } from './dom';

const root = () => document.getElementById('modal-root')!;

/** ダイアログを開き、resolve されるまで待つ */
export function ask<T>(build: (done: (v: T) => void) => HTMLElement, opts: { cls?: string } = {}): Promise<T> {
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
