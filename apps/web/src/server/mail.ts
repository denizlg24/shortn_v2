import "server-only";
import { createMailer, type Mailer } from "@shortn/emails";
import { env } from "./env";

let mailer: Mailer | undefined;

export function mail() {
  if (!mailer) {
    const e = env();
    mailer = createMailer({
      apiKey: e.RESEND_API_KEY,
      from: e.MAIL_FROM,
      allowlist: e.MAIL_ALLOWLIST,
      // Next serves apps/web/public from the dashboard origin.
      assetOrigin: e.BETTER_AUTH_URL,
    });
  }
  return mailer;
}
