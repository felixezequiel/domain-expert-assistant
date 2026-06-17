import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { ptBR } from "./locales/pt-BR/index.ts";
import { enUS } from "./locales/en-US/index.ts";

// Bilingual UI (pt-BR default, en-US). Resources are bundled (no async backend), so the first
// render already has translations. The chosen language is persisted in localStorage; tests
// pin en-US (see src/test/setup.ts) so the original English copy is what they assert.
export const SUPPORTED_LANGUAGES = ["pt-BR", "en-US"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: SupportedLanguage = "pt-BR";
const STORAGE_KEY = "lang";

function isSupported(value: string | null): value is SupportedLanguage {
  return value !== null && (SUPPORTED_LANGUAGES as ReadonlyArray<string>).includes(value);
}

function initialLanguage(): SupportedLanguage {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
    if (isSupported(stored)) {
      return stored;
    }
  } catch {
    // localStorage may be unavailable; fall back to the default.
  }
  return DEFAULT_LANGUAGE;
}

void i18n.use(initReactI18next).init({
  resources: {
    "pt-BR": { translation: ptBR },
    "en-US": { translation: enUS },
  },
  lng: initialLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
});

function reflectLanguage(lng: string): void {
  if (typeof document !== "undefined") {
    document.documentElement.lang = lng;
  }
}

reflectLanguage(i18n.language); // set <html lang> on first load, not only on change
i18n.on("languageChanged", (lng) => {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, lng);
  } catch {
    // ignore persistence failures
  }
  reflectLanguage(lng);
});

export default i18n;
