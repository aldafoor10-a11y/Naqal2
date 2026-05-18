/**
 * NAQAL GO - Locale context (ar/en) with persistence
 * Note: RTL is set globally in app/_layout.tsx; we only toggle text strings here.
 * Full RTL flip requires app reload, so we keep Arabic as default visual direction.
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { translations, type Locale } from '@/src/i18n';
import { storage } from '@/src/utils/storage';

type Ctx = {
  locale: Locale;
  t: (typeof translations)['ar'];
  setLocale: (l: Locale) => Promise<void>;
};

const LocaleContext = createContext<Ctx | null>(null);
const STORAGE_KEY = 'app_locale';

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('ar');

  useEffect(() => {
    (async () => {
      const saved = await storage.getItem<Locale>(STORAGE_KEY, 'ar');
      if (saved === 'en' || saved === 'ar') setLocaleState(saved);
    })();
  }, []);

  const setLocale = useCallback(async (l: Locale) => {
    setLocaleState(l);
    await storage.setItem(STORAGE_KEY, l);
  }, []);

  return (
    <LocaleContext.Provider value={{ locale, t: translations[locale], setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): Ctx {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used inside LocaleProvider');
  return ctx;
}
