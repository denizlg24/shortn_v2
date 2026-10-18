import { can, listApiKeys, platformFeatureEnabled } from "@shortn/core";
import { buttonVariants } from "@shortn/ui";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { Metadata } from "next";
import { Page } from "@/components/page/page";
import { ApiKeyManager } from "@/components/settings/api-keys/key-manager";
import { serviceContext } from "@/server/context";
import { env } from "@/server/env";
import { gateOf } from "@/lib/plan-features";
import { featureAccess } from "@/server/plan";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.apiKeys");
  return { title: t("title") };
}

export default async function ApiKeysPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/settings/api-keys">) {
  const { workspace } = await params;
  const [ctx, t, settings, query, api] = await Promise.all([
    serviceContext(workspace),
    getTranslations("settings.apiKeys"),
    getTranslations("settings"),
    searchParams,
    featureAccess(workspace, "api"),
  ]);
  const base = `/${workspace}/settings/api-keys`,
    config = env();
  const manage = can(ctx.actor, "apiKeys.manage");
  const before = typeof query.before === "string" ? query.before : undefined;
  const result = manage ? await listApiKeys(ctx, before, 25) : null;
  const enabled =
    config.PLATFORM_API_ENABLED === "1" &&
    Boolean(config.API_KEY_PEPPER) &&
    platformFeatureEnabled(ctx.workspace, "api", config.PLATFORM_API_ROLLOUT);
  const now = new Date();
  const items = result?.ok
    ? result.value.items.map((key) => ({
        ...key,
        createdAt: key.createdAt.toISOString(),
        lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
        expiresAt: key.expiresAt?.toISOString() ?? null,
        revokedAt: key.revokedAt?.toISOString() ?? null,
        expired: Boolean(
          key.expiresAt && key.expiresAt.getTime() <= now.getTime(),
        ),
      }))
    : [];
  return (
    <Page
      crumbs={[
        { label: settings("title"), href: `/${workspace}/settings` },
        { label: t("title") },
      ]}
      title={t("title")}
      description={t("description")}
    >
      {!manage ? (
        <p className="text-small text-fg-muted">{t("adminOnly")}</p>
      ) : result && !result.ok ? (
        <p role="alert" className="text-small text-danger">
          {t("errors.invalid_input")}{" "}
          <Link href={base} className="underline underline-offset-4">
            {t("firstPage")}
          </Link>
        </p>
      ) : (
        <>
          <ApiKeyManager
            workspace={workspace}
            items={items}
            enabled={enabled}
            gate={gateOf(api)}
            today={now.toISOString().slice(0, 10)}
          />
          <nav
            aria-label={t("pagination")}
            className="mt-5 flex flex-wrap items-center justify-between gap-3 text-small"
          >
            <p className="text-fg-muted">
              {t("pageCount", { count: items.length })}
            </p>
            <div className="flex flex-wrap gap-2">
              {before ? (
                <Link
                  href={base}
                  className={buttonVariants({
                    variant: "secondary",
                    size: "md",
                  })}
                >
                  {t("firstPage")}
                </Link>
              ) : null}
              {result?.ok && result.value.nextCursor ? (
                <Link
                  href={`${base}?before=${result.value.nextCursor}`}
                  className={buttonVariants({
                    variant: "secondary",
                    size: "md",
                  })}
                >
                  {t("older")}
                </Link>
              ) : null}
            </div>
          </nav>
        </>
      )}
    </Page>
  );
}
