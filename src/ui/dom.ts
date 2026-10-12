type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, unknown> & { class?: string; style?: string };

/** 小さな DOM ビルダー */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
      else if (k === 'class') el.className = String(v);
      else if (k === 'style') el.setAttribute('style', String(v));
      else if (k === 'disabled') (el as HTMLButtonElement).disabled = Boolean(v);
      else el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

export function append(el: HTMLElement, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(el: HTMLElement): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function btn(label: Child, onclick: () => void, cls = ''): HTMLButtonElement {
  return h('button', { class: `btn ${cls}`.trim(), onclick }, label);
}

export function bar(frac: number, cls: string): HTMLElement {
  const pct = Math.max(0, Math.min(1, frac)) * 100;
  return h('div', { class: `bar ${cls}` }, h('i', { style: `width:${pct.toFixed(1)}%` }));
}
