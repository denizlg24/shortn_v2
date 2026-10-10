import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { localeCookie, resolveLocale } from "./locale";

export default getRequestConfig(async () => {
  const locale = resolveLocale(
    (await cookies()).get(localeCookie)?.value,
    (await headers()).get("accept-language"),
  );
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
