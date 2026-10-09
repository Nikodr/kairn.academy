type Child = Node | string | null | undefined | false;

interface Options {
  class?: string;
  attrs?: Record<string, string>;
}

/** Construit un élément ; les chaînes deviennent des nœuds texte (jamais de HTML), donc rien à échapper. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: Options = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (options.class) el.className = options.class;
  for (const [name, value] of Object.entries(options.attrs ?? {})) el.setAttribute(name, value);
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return el;
}
