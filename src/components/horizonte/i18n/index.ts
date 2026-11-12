import { useEffect, useSyncExternalStore } from "react";
import { nameUnnamed } from "../content";
import { EN } from "./en";
import type { Locale } from "./locale";
import { PT_BR } from "./pt-BR";
import { applyDocumentLocale, getLocale, getServerLocale, setLocale, subscribeLocale } from "./store";
import type { Copy } from "./types";

export const COPY: Record<Locale, Copy> = { en: EN, "pt-BR": PT_BR };

export const copyOf = (locale: Locale): Copy => COPY[locale];

const nameLocalAlbums = () => nameUnnamed(COPY[getLocale()].local);
nameLocalAlbums();
subscribeLocale(nameLocalAlbums);

export function useLocale(): Locale {
  return useSyncExternalStore(subscribeLocale, getLocale, getServerLocale);
}

export function useCopy(): Copy {
  return COPY[useLocale()];
}

export function useDocumentLocale(): Locale {
  const locale = useLocale();
  useEffect(() => applyDocumentLocale(locale), [locale]);
  return locale;
}

export { setLocale };
export { LOCALES, type Locale } from "./locale";
export type { Copy, Phrasing } from "./types";
