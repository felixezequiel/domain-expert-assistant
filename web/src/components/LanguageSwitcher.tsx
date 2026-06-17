import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "../i18n/index.ts";
import { cn } from "../lib/utils.ts";

// Compact pt-BR / en-US toggle for the top bar. The language is persisted (i18n config) so it
// survives reloads; pt-BR is the default.
const SHORT_LABELS: Record<string, string> = { "pt-BR": "PT", "en-US": "EN" };

export function LanguageSwitcher(): JSX.Element {
  const { t, i18n } = useTranslation();
  const current = i18n.resolvedLanguage ?? i18n.language;

  return (
    <div
      role="group"
      aria-label={t("nav.language.label")}
      className="flex items-center rounded-md border border-border p-0.5"
    >
      {SUPPORTED_LANGUAGES.map((language) => (
        <button
          key={language}
          type="button"
          onClick={() => void i18n.changeLanguage(language)}
          aria-pressed={current === language}
          className={cn(
            "rounded px-2 py-0.5 text-xs font-medium transition-colors",
            current === language
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {SHORT_LABELS[language]}
        </button>
      ))}
    </div>
  );
}
