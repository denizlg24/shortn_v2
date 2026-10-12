"use server";
import {
  addDomain,
  assignDomainLink,
  can,
  createLink,
  domainAllowance,
  listDomains,
  moveDomainLinks,
  removeDomain,
  retryDomain,
} from "@shortn/core";
import { createPolar, domainAddonCheckout } from "@shortn/billing";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { serviceContext } from "../context";
import { env } from "../env";
import { requireSession } from "../workspace";
export async function addDomainAction(workspace: string, form: FormData) {
  if (env().DOMAIN_WRITES !== "1") return;
  const bioPageId = String(form.get("bioPageId") ?? "");
  const result = await addDomain(
    await serviceContext(workspace),
    {
      hostname: form.get("hostname"),
      kind: form.get("kind"),
      ...(bioPageId ? { bioPageId } : {}),
    },
    env().LINK_DOMAIN,
  );
  revalidatePath(`/${workspace}/settings/domains`);
  redirect(
    `/${workspace}/settings/domains?${result.ok ? "saved=1" : "failed=1"}`,
  );
}
export async function removeDomainAction(workspace: string, id: string) {
  const result = await removeDomain(await serviceContext(workspace), id);
  revalidatePath(`/${workspace}/settings/domains`);
  redirect(
    `/${workspace}/settings/domains?${result.ok ? "saved=1" : "failed=1"}`,
  );
}
export async function retryDomainAction(workspace: string, id: string) {
  const result = await retryDomain(await serviceContext(workspace), id);
  revalidatePath(`/${workspace}/settings/domains`);
  redirect(
    `/${workspace}/settings/domains?${result.ok ? "saved=1" : "failed=1"}`,
  );
}
export async function recoverDomainAction(workspace: string, id: string) {
  const result = await moveDomainLinks(await serviceContext(workspace), id);
  revalidatePath(`/${workspace}/settings/domains`);
  redirect(
    `/${workspace}/settings/domains?${result.ok ? (result.value.conflicts.length ? "conflicts=1" : "saved=1") : "failed=1"}`,
  );
}
export async function buyDomainAddonAction(workspace: string) {
  const e = env(),
    ctx = await serviceContext(workspace);
  if (
    !can(ctx.actor, "billing.manage") ||
    e.BILLING_WRITES !== "1" ||
    !e.POLAR_DOMAIN_PRODUCT_ID ||
    e.DOMAIN_WRITES !== "1"
  )
    return;
  const [allowance, domains] = await Promise.all([
    domainAllowance(ctx.db, ctx.workspace._id),
    listDomains(ctx),
  ]);
  if (
    allowance > domains.filter((domain) => domain.status !== "disabled").length
  )
    return;
  const session = await requireSession();
  const url = await domainAddonCheckout(
    createPolar({
      accessToken: e.POLAR_ACCESS_TOKEN,
      server: e.POLAR_ENVIRONMENT,
    }),
    {
      productId: e.POLAR_DOMAIN_PRODUCT_ID,
      workspaceId: ctx.workspace._id,
      customerExternalId: ctx.workspace.ownerUserId,
      email: session.user.email,
      returnUrl: `${e.BETTER_AUTH_URL}/${workspace}/settings/domains`,
    },
  );
  redirect(url);
}

export async function assignDomainLinkAction(
  workspace: string,
  domainId: string,
  form: FormData,
) {
  if (env().DOMAIN_WRITES !== "1") return;
  const result = await assignDomainLink(
    await serviceContext(workspace),
    domainId,
    String(form.get("linkId") ?? ""),
  );
  revalidatePath(`/${workspace}/settings/domains`);
  redirect(
    `/${workspace}/settings/domains?${result.ok ? "saved=1" : "failed=1"}`,
  );
}

export async function createDomainLinkAction(
  workspace: string,
  domainId: string,
  form: FormData,
) {
  if (env().DOMAIN_WRITES !== "1") return;
  const ctx = await serviceContext(workspace),
    domain = (await listDomains(ctx)).find((domain) => domain.id === domainId);
  const result =
    domain &&
    (await createLink(ctx, {
      domain: domain.hostname,
      url: String(form.get("url") ?? ""),
      key: String(form.get("key") ?? ""),
      title: String(form.get("title") ?? ""),
    }));
  revalidatePath(`/${workspace}/settings/domains`);
  redirect(
    `/${workspace}/settings/domains?${result?.ok ? "saved=1" : "failed=1"}`,
  );
}
