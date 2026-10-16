import { can, listWebhooks, webhookWritable } from "@shortn/core";
import { buttonVariants } from "@shortn/ui";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Page } from "@/components/page/page";
import { inputClass } from "@/components/page/form";
import { WebhookManager } from "@/components/settings/webhooks/manager";
import { serviceContext } from "@/server/context";
import { env } from "@/server/env";
export async function generateMetadata() {
  return { title: (await getTranslations("settings.webhooks"))("title") };
}
export default async function WebhooksPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/settings/webhooks">) {
  const { workspace } = await params;
  const [ctx, t, settings, query] = await Promise.all([
    serviceContext(workspace),
    getTranslations("settings.webhooks"),
    getTranslations("settings"),
    searchParams,
  ]);
  const base = `/${workspace}/settings/webhooks`,
    config = env();
  const cursor = typeof query.cursor === "string" ? query.cursor : undefined,
    search = typeof query.search === "string" ? query.search : "";
  const manage = can(ctx.actor, "webhooks.manage");
  const result = manage
    ? await listWebhooks(ctx, {
        ...(cursor ? { cursor } : {}),
        search,
        limit: 25,
      })
    : null;
  const enabled = !webhookWritable(ctx, {
    enabled: config.PLATFORM_WEBHOOKS_ENABLED === "1",
    secretKey: config.WEBHOOK_SECRET_KEY ?? "",
    rolloutPercent: config.PLATFORM_WEBHOOKS_ROLLOUT,
  });
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
            {t("first")}
          </Link>
        </p>
      ) : (
        <>
          <form
            action={base}
            className="mb-6 flex max-w-xl flex-wrap items-end gap-2"
          >
            <label className="w-full min-w-0 flex-none text-small font-medium sm:flex-1">
              {t("search")}
              <input
                name="search"
                className={`${inputClass} mt-2`}
                maxLength={200}
                defaultValue={search}
                type="search"
              />
            </label>
            <button className={buttonVariants({ variant: "secondary" })}>
              {t("search")}
            </button>
            {search ? (
              <Link
                className={buttonVariants({ variant: "ghost" })}
                href={base}
              >
                {t("clear")}
              </Link>
            ) : null}
          </form>
          <WebhookManager
            workspace={workspace}
            items={result?.ok ? result.value.items : []}
            enabled={enabled}
          />
          <nav
            aria-label={t("pagination")}
            className="mt-5 flex flex-wrap items-center justify-between gap-3 text-small"
          >
            <p className="text-fg-muted">
              {t("pageCount", {
                count: result?.ok ? result.value.items.length : 0,
              })}
            </p>
            <div className="flex flex-wrap gap-2">
              {cursor ? (
                <Link
                  className={buttonVariants({ variant: "secondary" })}
                  href={`${base}?${new URLSearchParams({ search })}`}
                >
                  {t("first")}
                </Link>
              ) : null}
              {result?.ok && result.value.nextCursor ? (
                <Link
                  className={buttonVariants({ variant: "secondary" })}
                  href={`${base}?${new URLSearchParams({ search, cursor: result.value.nextCursor })}`}
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
