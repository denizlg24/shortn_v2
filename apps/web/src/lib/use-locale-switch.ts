import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { localeCookie, type Locale } from "@/i18n/locale";

const oneYear = 60 * 60 * 24 * 365;

function persistLocale(locale: Locale) {
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${localeCookie}=${locale}; path=/; max-age=${oneYear}; samesite=lax${secure}`;
}

export function useLocaleSwitch() {
  const router = useRouter();
  return useCallback(
    (locale: Locale) => {
      persistLocale(locale);
      router.refresh();
    },
    [router],
  );
}
