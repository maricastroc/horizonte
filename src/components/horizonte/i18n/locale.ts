export type Locale = "en" | "pt-BR";

export const LOCALES: readonly Locale[] = ["en", "pt-BR"];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_KEY = "horizonte:locale";

export const PENDING_ATTR = "data-locale-pending";

export function pickLocale(stored: string | null, languages: readonly string[]): Locale {
  if (stored === "en" || stored === "pt-BR") return stored;
  for (let i = 0; i < languages.length; i++) {
    const tag = String(languages[i] || "").toLowerCase();
    if (tag === "pt" || tag.indexOf("pt-") === 0) return "pt-BR";
    if (tag === "en" || tag.indexOf("en-") === 0) return "en";
  }
  return "en";
}

export const isLocale = (v: unknown): v is Locale => v === "en" || v === "pt-BR";

export const BOOT_SCRIPT =
  "(function(){var d=document.documentElement,s=null;" +
  `try{s=localStorage.getItem(${JSON.stringify(LOCALE_KEY)})}catch(e){}` +
  "var n=navigator,l=n.languages&&n.languages.length?n.languages:[n.language||''];" +
  `var p=(${pickLocale.toString()})(s,l);` +
  `d.lang=p;if(p!==${JSON.stringify(DEFAULT_LOCALE)})d.setAttribute(${JSON.stringify(PENDING_ATTR)},'');` +
  "})();";
