'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { en, type Dictionary, type PartialDictionary } from './en';
import { hi } from './hi';
import { isLanguage, type Language } from './languages';

export {
  LANGUAGES,
  fromApiLanguage,
  toApiLanguage,
  type ApiLanguage,
  type Language,
} from './languages';

const STORAGE_KEY = 'tl_lang';

/** English and Hindi ship with the page; the others load when chosen. */
const loaders: Record<Exclude<Language, 'en' | 'hi'>, () => Promise<PartialDictionary>> = {
  bn: () => import('./bn').then((m) => m.bn),
  mr: () => import('./mr').then((m) => m.mr),
  ta: () => import('./ta').then((m) => m.ta),
  te: () => import('./te').then((m) => m.te),
  kn: () => import('./kn').then((m) => m.kn),
  ml: () => import('./ml').then((m) => m.ml),
};

/** Fills gaps in a translation with English, so a missing string never shows as blank. */
function withFallback(partial: PartialDictionary): Dictionary {
  const merge = (base: Record<string, unknown>, over: Record<string, unknown> | undefined) => {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(base)) {
      const value = base[key];
      const replacement = over?.[key];
      out[key] =
        typeof value === 'string'
          ? typeof replacement === 'string' && replacement
            ? replacement
            : value
          : merge(value as Record<string, unknown>, replacement as Record<string, unknown>);
    }
    return out;
  };
  return merge(en, partial as Record<string, unknown>) as Dictionary;
}

const loaded = new Map<Language, Dictionary>([
  ['en', en],
  ['hi', withFallback(hi)],
]);

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Dictionary;
  format: (template: string, values: Record<string, string | number>) => string;
  /** BCP 47 tag for dates and numbers, e.g. ta-IN. */
  locale: string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [dictionary, setDictionary] = useState<Dictionary>(en);

  const apply = useCallback((next: Language) => {
    setLanguageState(next);
    const ready = loaded.get(next);
    if (ready) {
      setDictionary(ready);
      return;
    }
    void loaders[next as keyof typeof loaders]()
      .then((partial) => {
        const full = withFallback(partial);
        loaded.set(next, full);
        // Ignore a late load if the customer has already switched again.
        setLanguageState((current) => {
          if (current === next) setDictionary(full);
          return current;
        });
      })
      .catch(() => setDictionary(en));
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && isLanguage(saved)) apply(saved);
    } catch {
      // Storage unavailable (private mode); keep the default language.
    }
  }, [apply]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback(
    (next: Language) => {
      apply(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Ignore storage errors; the choice still applies for this visit.
      }
    },
    [apply],
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t: dictionary,
      locale: `${language}-IN`,
      format: (template, values) =>
        template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`)),
    }),
    [language, setLanguage, dictionary],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useI18n must be used inside LanguageProvider');
  return context;
}
