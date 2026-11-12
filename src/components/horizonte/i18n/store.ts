import { DEFAULT_LOCALE, LOCALE_KEY, PENDING_ATTR, isLocale, pickLocale, type Locale } from "./locale";

let current: Locale | null = null;
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function detect(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  let stored: string | null = null;
  try {
    stored = storage()?.getItem(LOCALE_KEY) ?? null;
  } catch {
    stored = null;
  }
  const nav = window.navigator;
  const languages = nav.languages?.length ? nav.languages : [nav.language ?? ""];
  return pickLocale(stored, languages);
}

export function getLocale(): Locale {
  if (current === null) current = detect();
  return current;
}

export const getServerLocale = (): Locale => DEFAULT_LOCALE;

export function subscribeLocale(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function persist(locale: Locale): boolean {
  try {
    storage()?.setItem(LOCALE_KEY, locale);
    return true;
  } catch {
    return false;
  }
}

export function setLocale(next: Locale) {
  if (!isLocale(next)) return;
  persist(next);
  if (next === getLocale()) return;
  current = next;
  listeners.forEach((fn) => fn());
}

export function applyDocumentLocale(locale: Locale) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (root.lang !== locale) root.lang = locale;
  if (locale === getLocale()) root.removeAttribute(PENDING_ATTR);
}

export function forgetLocale() {
  current = null;
  listeners.forEach((fn) => fn());
}
