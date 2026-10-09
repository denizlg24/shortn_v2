import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  INTL_LOCALE,
  UI_STRINGS,
  type Locale,
  type UIStrings,
} from "./strings";

interface UILocaleValue {
  locale: Locale;
  intlLocale: string;
  t: UIStrings;
}

const UILocaleContext = createContext<UILocaleValue>({
  locale: "en",
  intlLocale: INTL_LOCALE.en,
  t: UI_STRINGS.en,
});

export function UILocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ locale, intlLocale: INTL_LOCALE[locale], t: UI_STRINGS[locale] }),
    [locale],
  );
  return (
    <UILocaleContext.Provider value={value}>
      {children}
    </UILocaleContext.Provider>
  );
}

export function useUILocale(): UILocaleValue {
  return useContext(UILocaleContext);
}
