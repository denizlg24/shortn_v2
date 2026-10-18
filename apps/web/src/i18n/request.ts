import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import {
  isLocale,
  localeCookie,
  resolveLocale,
  routedLocaleHeader,
} from "./locale";

// `locale` is set when a page asks for one explicitly, e.g. the safety page
// takes it from its URL instead of the visitor's cookie. Marketing pages also
// take it from their URL: the proxy forwards it in a header it strips from
// every other request.
export default getRequestConfig(async ({ locale: requested }) => {
  const routed = requested ?? (await headers()).get(routedLocaleHeader);
  const locale = isLocale(routed)
    ? routed
    : resolveLocale(
        (await cookies()).get(localeCookie)?.value,
        (await headers()).get("accept-language"),
      );
  return {
    locale,
    messages: (await import(`../../messages/${locale}/index.ts`)).default,
  };
});
