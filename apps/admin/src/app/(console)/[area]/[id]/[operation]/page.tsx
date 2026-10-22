import { features as catalogFeatures } from "@shortn/billing";
import { notFound } from "next/navigation";
import { ObjectId, type Document } from "mongodb";
import {
  consoleActions,
  adminPermissions,
  deletionPreflight,
} from "@shortn/core";
import { moderationCategories, suspensionCategories } from "@shortn/db";
import { ActionGate } from "@/components/action-gate";
import { ActionForm, fieldClass } from "@/components/action-form";
import { PageHeader, PageBody } from "@/components/page";
import { areas, jobCollections } from "@/server/areas";
import { actionGate } from "@/server/gate";
import { db } from "@/server/db";
import { param } from "@/server/list";
import { submitConsoleAction } from "@/server/console-actions";

function Field({
  name,
  label,
  type = "text",
  hint,
}: {
  name: string;
  label: string;
  type?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-small font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        className={fieldClass}
        maxLength={4000}
      />
      {hint ? <p className="text-meta text-fg-muted">{hint}</p> : null}
    </div>
  );
}
function Select({
  name,
  label,
  values,
}: {
  name: string;
  label: string;
  values: readonly string[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-small font-medium">
        {label}
      </label>
      <select name={name} id={name} className={fieldClass}>
        {values.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    </div>
  );
}
export default async function ActionPage({
  params,
  searchParams,
}: PageProps<"/[area]/[id]/[operation]">) {
  const { area, id, operation } = await params;
  const config = areas[area];
  const permission = consoleActions[`${area}/${operation}`];
  if (!config || !permission) notFound();
  const { denial, current } = await actionGate(permission);
  const search = await searchParams;
  const kind = param(search, "kind") ?? "imports";
  const name = area === "jobs" ? jobCollections[kind] : config.collection;
  if (!name) notFound();
  if (
    !ObjectId.isValid(id) &&
    !(area === "jobs" && kind === "billing" && /^[\w.:-]{1,200}$/.test(id))
  )
    notFound();
  const row = await (
    await db()
  )
    .collection<Document & { _id: ObjectId | string }>(name)
    .findOne(
      { _id: area === "jobs" && kind === "billing" ? id : new ObjectId(id) },
      {
        projection: {
          email: 1,
          slug: 1,
          key: 1,
          hostname: 1,
          entitlementOverride: 1,
          platformFeatures: 1,
        },
      },
    );
  if (!row) notFound();
  const destructive = [
    "ban",
    "suspend",
    "remove",
    "takedown",
    "role",
    "delete",
    "revoke",
    "refund",
  ].includes(operation);
  const confirm = destructive
    ? String(row.email ?? row.slug ?? row.key ?? row.hostname ?? id)
    : undefined;
  const preflight =
    operation === "delete"
      ? await deletionPreflight(await db(), new ObjectId(id))
      : null;
  const base = `/${area}/${id}`;
  const title = operation.split("-").join(" ");
  const action = submitConsoleAction.bind(null, area, id, operation, kind);
  return (
    <>
      <PageHeader
        title={title}
        crumbs={[
          { label: config.title, href: `/${area}` },
          { label: id, href: base },
        ]}
      />
      <PageBody>
        <ActionGate denial={denial} next={`${base}/${operation}`}>
          <p className="max-w-prose text-small text-fg-muted">
            {operation === "delete"
              ? "Schedule permanent account erasure after a seven-day grace period. Sign-in and credentials stop immediately. Review owned workspaces before continuing."
              : `Apply ${title} to ${row.email ?? row.slug ?? row.key ?? row.hostname ?? id}. This action is recorded in the staff audit log.`}
          </p>
          {preflight ? (
            <div className="text-small">
              <p>
                {preflight.blocked
                  ? "Transfer team workspaces with other members before scheduling deletion."
                  : "These owned workspaces and their data will be erased:"}
              </p>
              <ul className="list-disc pl-5">
                {preflight.workspaces.map((w) => (
                  <li key={w.id}>
                    {w.name}: {w.links} links, {w.qr} QR codes, {w.bio} bio
                    pages, {w.events} click events, {w.subscriptions} paid
                    subscriptions, {w.domains} domains, {w.otherMembers} other
                    members
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <ActionForm
            action={action}
            submitLabel={title}
            cancelHref={base}
            reason={
              adminPermissions[permission].reason || operation === "cancel"
                ? "required"
                : "optional"
            }
            {...(confirm ? { confirm } : {})}
            danger={destructive}
          >
            {operation === "ban" ? (
              <Field
                name="expiresAt"
                label="Ban expires (optional)"
                type="datetime-local"
              />
            ) : null}
            {["takedown", "suspend", "lock"].includes(operation) ? (
              <>
                <Select
                  name="category"
                  label="Category"
                  values={
                    area === "links"
                      ? moderationCategories
                      : suspensionCategories
                  }
                />
                <Field name="publicNote" label="Public note (optional)" />
              </>
            ) : null}
            {operation === "role" ? (
              <Select
                name="role"
                label="Role"
                values={["user", "admin", "superadmin"]}
              />
            ) : null}
            {operation === "impersonate" ? (
              <>
                <Select
                  name="mode"
                  label="Mode"
                  values={
                    current.admin.role === "superadmin"
                      ? ["read", "write"]
                      : ["read"]
                  }
                />
                <Field
                  name="workspace"
                  label="Target workspace slug (optional)"
                />
              </>
            ) : null}
            {operation === "override" ? (
              <>
                <div className="flex flex-col gap-1">
                  <label htmlFor="clear" className="text-small font-medium">
                    Override action
                  </label>
                  <select name="clear" id="clear" className={fieldClass}>
                    <option value="no">Set override</option>
                    <option value="yes">Clear override</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="plan" className="text-small font-medium">
                    Complimentary plan
                  </label>
                  <select
                    name="plan"
                    id="plan"
                    defaultValue={row.entitlementOverride?.plan ?? ""}
                    className={fieldClass}
                  >
                    <option value="">Keep subscription plan</option>
                    {["free", "basic", "plus", "pro", "enterprise"].map(
                      (plan) => (
                        <option key={plan}>{plan}</option>
                      ),
                    )}
                  </select>
                </div>
                <Field
                  name="expiresAt"
                  label="Expires (required for admin)"
                  type="datetime-local"
                />
                <fieldset className="flex flex-col gap-3">
                  <legend className="mb-2 text-small font-medium">
                    Limit overrides
                  </legend>
                  {[
                    ["links", "Links per month"],
                    ["qrCodes", "QR codes per month"],
                    ["bioPages", "Bio pages"],
                    ["seats", "Seats"],
                    ["workspaces", "Workspaces"],
                    ["analyticsDays", "Analytics days"],
                    ["apiPerMinute", "API requests per minute"],
                  ].map(([key, label]) => (
                    <div
                      key={key}
                      className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2"
                    >
                      <div className="flex flex-col gap-1">
                        <label htmlFor={`mode_${key}`} className="text-small">
                          {label}
                        </label>
                        <select
                          id={`mode_${key}`}
                          name={`mode_${key}`}
                          className={fieldClass}
                          defaultValue={
                            row.entitlementOverride?.limits?.[key!] === null
                              ? "unlimited"
                              : row.entitlementOverride?.limits?.[key!] !==
                                  undefined
                                ? "custom"
                                : "plan"
                          }
                        >
                          <option value="plan">Plan default</option>
                          <option value="unlimited">Unlimited</option>
                          <option value="custom">Custom limit</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label
                          htmlFor={`limit_${key}`}
                          className="text-meta text-fg-muted"
                        >
                          Custom {label?.toLowerCase()}
                        </label>
                        <input
                          id={`limit_${key}`}
                          name={`limit_${key}`}
                          type="number"
                          min="0"
                          step="1"
                          defaultValue={
                            row.entitlementOverride?.limits?.[key!] ?? ""
                          }
                          className={fieldClass}
                        />
                      </div>
                    </div>
                  ))}
                </fieldset>
              </>
            ) : null}
            {operation === "override" ? (
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-2 text-small font-medium">
                  Plan feature overrides
                </legend>
                {catalogFeatures.map((feature) => (
                  <div key={feature} className="flex flex-col gap-1">
                    <label
                      htmlFor={`plan_feature_${feature}`}
                      className="text-small"
                    >
                      {
                        {
                          customKeys: "Custom short keys",
                          passwords: "Passwords",
                          campaigns: "Campaigns",
                          campaignExport: "Campaign exports",
                          analyticsBreakdowns: "Advanced analytics",
                          csvExport: "CSV exports",
                          qrLogo: "QR logos",
                          api: "REST API",
                          mcp: "MCP",
                        }[feature]
                      }
                    </label>
                    <select
                      id={`plan_feature_${feature}`}
                      name={`plan_feature_${feature}`}
                      defaultValue={
                        row.entitlementOverride?.features?.add?.includes(
                          feature,
                        )
                          ? "add"
                          : row.entitlementOverride?.features?.remove?.includes(
                                feature,
                              )
                            ? "remove"
                            : "default"
                      }
                      className={fieldClass}
                    >
                      <option value="default">Plan default</option>
                      <option value="add">Enabled</option>
                      <option value="remove">Disabled</option>
                    </select>
                  </div>
                ))}
              </fieldset>
            ) : null}
            {operation === "features" ? (
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-2 text-small font-medium">
                  Platform features
                </legend>
                {[
                  ["api", "REST API"],
                  ["mcp", "MCP"],
                  ["webhooks", "Webhooks"],
                  ["bulk", "Bulk actions"],
                  ["linkRules", "Link rules"],
                  ["advancedAuth", "Advanced authentication"],
                ].map(([key, label]) => (
                  <div key={key} className="flex flex-col gap-1">
                    <label htmlFor={`feature_${key}`} className="text-small">
                      {label}
                    </label>
                    <select
                      id={`feature_${key}`}
                      name={`feature_${key}`}
                      defaultValue={
                        row.platformFeatures?.[key!] === true
                          ? "on"
                          : row.platformFeatures?.[key!] === false
                            ? "off"
                            : "default"
                      }
                      className={fieldClass}
                    >
                      <option value="default">Rollout default</option>
                      <option value="on">Enabled</option>
                      <option value="off">Disabled</option>
                    </select>
                  </div>
                ))}
              </fieldset>
            ) : null}
            {operation === "triage" ? (
              <>
                <Select
                  name="status"
                  label="Status"
                  values={["new", "open", "replied", "closed", "spam"]}
                />
                <Field name="assignee" label="Assignee" />
                <Field name="note" label="Internal note" />
              </>
            ) : null}
            {operation === "refund" ? (
              <>
                <input
                  type="hidden"
                  name="requestKey"
                  value={crypto.randomUUID()}
                />
                <Field name="orderId" label="Polar order ID" />
                <Field
                  name="amount"
                  label="Refund amount (minor currency units)"
                  type="number"
                />
                <Select
                  name="refundReason"
                  label="Refund reason"
                  values={[
                    "customer_request",
                    "duplicate",
                    "fraudulent",
                    "service_disruption",
                    "satisfaction_guarantee",
                    "other",
                  ]}
                />
              </>
            ) : null}
          </ActionForm>
        </ActionGate>
      </PageBody>
    </>
  );
}
