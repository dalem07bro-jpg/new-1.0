import { STR } from '../data/strings';

export type Lang = 'en' | 'de';
export interface L {
  en: string;
  de: string;
}

let lang: Lang = 'en';
export function setLang(l: Lang) {
  lang = l;
  document.documentElement.lang = l;
}
export function getLang(): Lang {
  return lang;
}
export function detectLang(): Lang {
  const n = (navigator.language || 'en').toLowerCase();
  return n.startsWith('de') ? 'de' : 'en';
}

function fill(s: string, p?: Record<string, string | number>) {
  if (!p) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (p[k] !== undefined ? String(p[k]) : `{${k}}`));
}

/** Translate a UI key from the string table. */
export function t(key: keyof typeof STR, p?: Record<string, string | number>): string {
  const e = STR[key] as L | undefined;
  if (!e) return String(key);
  return fill(e[lang] ?? e.en, p);
}

/** Translate an inline localized value (content definitions). */
export function tr(l: L | string, p?: Record<string, string | number>): string {
  if (typeof l === 'string') return fill(l, p);
  return fill(l[lang] ?? l.en, p);
}
