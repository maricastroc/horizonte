"use client";

import { LOCALES, setLocale, useCopy, useLocale } from "./i18n";

export default function LanguageSwitch({ compact, ink }: { compact: boolean; ink: string }) {
  const t = useCopy().language;
  const locale = useLocale();
  return (
    <div role="group" aria-label={t.label} className="flex items-center">
      {LOCALES.map((l, i) => {
        const on = l === locale;
        return (
          <span key={l} className="flex items-center">
            {i > 0 && (
              <span aria-hidden className="px-1 text-chevron">
                /
              </span>
            )}
            <button
              type="button"
              lang={l}
              aria-label={t.name[l]}
              aria-pressed={on}
              title={t.name[l]}
              onClick={() => setLocale(l)}
              className={[
                "cursor-pointer whitespace-nowrap transition-colors duration-150",
                compact ? "flex min-h-[32px] min-w-[32px] items-center justify-center" : "py-0.75",
                on ? "text-ink-text" : "text-ink-faint hover:text-ink-text",
              ].join(" ")}
            >
              <span style={on ? { boxShadow: `inset 0 -1px 0 ${ink}` } : undefined}>
                {t.short[l]}
              </span>
            </button>
          </span>
        );
      })}
    </div>
  );
}
