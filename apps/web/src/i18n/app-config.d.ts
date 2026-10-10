import type messages from "../../messages/en/index";
import type { Locale } from "./locale";

declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
