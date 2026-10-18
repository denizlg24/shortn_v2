import { getTranslations } from "next-intl/server";
import { AuthHeading } from "./auth-parts";

export async function McpOAuthInvalid() {
  const t = await getTranslations("mcpOAuth");
  return (
    <AuthHeading
      title={t("invalid.title")}
      description={t("invalid.description")}
    />
  );
}
export async function McpCallback({ address }: { address: string }) {
  const t = await getTranslations("mcpOAuth");
  const url = new URL(address),
    origin =
      url.origin === "null" ? `${url.protocol}//${url.host}` : url.origin;
  return (
    <div className="flex flex-col gap-1.5 border-t border-line pt-4">
      <p className="text-small font-medium">{t("callback")}</p>
      <p
        className="line-clamp-2 break-all text-small text-fg-muted"
        title={origin}
      >
        {origin}
      </p>
      <details className="text-small text-fg-muted">
        <summary className="cursor-pointer underline-offset-4 hover:text-fg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">
          {t("fullAddress")}
        </summary>
        <p className="mt-2 break-all">{address}</p>
      </details>
    </div>
  );
}
