import {
  can,
  getWebhook,
  webhookView,
  listWebhookDeliveries,
  webhookWritable,
} from "@shortn/core";
import { buttonVariants } from "@shortn/ui";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Page } from "@/components/page/page";
import { DeliveryLog } from "@/components/settings/webhooks/manager";
import { serviceContext } from "@/server/context";
import { env } from "@/server/env";
export async function generateMetadata() {
  return { title: (await getTranslations("settings.webhooks"))("deliveries") };
}
export default async function WebhookDeliveriesPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/settings/webhooks/[id]">) {
  const { workspace, id } = await params;
  const [ctx, t, settings, query] = await Promise.all([
    serviceContext(workspace),
    getTranslations("settings.webhooks"),
    getTranslations("settings"),
    searchParams,
  ]);
  if (!can(ctx.actor, "webhooks.manage")) notFound();
  const endpoint = await getWebhook(ctx, id);
  if (!endpoint) notFound();
  const cursor = typeof query.cursor === "string" ? query.cursor : undefined;
  const result = await listWebhookDeliveries(ctx, id, {
    ...(cursor ? { cursor } : {}),
    limit: 25,
  });
  const base = `/${workspace}/settings/webhooks`,
    config = env();
  const enabled = !webhookWritable(ctx, {
    enabled: config.PLATFORM_WEBHOOKS_ENABLED === "1",
    secretKey: config.WEBHOOK_SECRET_KEY ?? "",
    rolloutPercent: config.PLATFORM_WEBHOOKS_ROLLOUT,
  });
  return (
    <Page
      crumbs={[
        { label: settings("title"), href: `/${workspace}/settings` },
        { label: t("title"), href: base },
        { label: t("deliveries") },
      ]}
      title={endpoint.name}
      description={t("deliveryDescription")}
    >
      {!result.ok ? (
        <p role="alert" className="text-small text-danger">
          {t("errors.invalid_input")}{" "}
          <Link className="underline underline-offset-4" href={`${base}/${id}`}>
            {t("first")}
          </Link>
        </p>
      ) : (
        <>
          {!enabled || !endpoint.enabled ? (
            <p className="mb-4 text-small text-fg-muted">
              {t(!enabled ? "disabledHelp" : "errors.endpoint_disabled")}
            </p>
          ) : null}
          <DeliveryLog
            workspace={workspace}
            endpoint={webhookView(endpoint)}
            items={result.value.items}
            enabled={enabled}
          />
          <nav
            aria-label={t("pagination")}
            className="mt-5 flex flex-wrap justify-between gap-3 text-small"
          >
            <p className="text-fg-muted">
              {t("pageCount", { count: result.value.items.length })}
            </p>
            <div className="flex flex-wrap gap-2">
              {cursor ? (
                <Link
                  className={buttonVariants({ variant: "secondary" })}
                  href={`${base}/${id}`}
                >
                  {t("first")}
                </Link>
              ) : null}
              {result.value.nextCursor ? (
                <Link
                  className={buttonVariants({ variant: "secondary" })}
                  href={`${base}/${id}?cursor=${result.value.nextCursor}`}
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
