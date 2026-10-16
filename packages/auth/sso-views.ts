import { ObjectId, type Db, type Filter, type Document } from "mongodb";
import { physicalNames } from "@shortn/db";

export const SSO_PAGE_SIZE = 10;
export interface SsoProviderView {
  id: string;
  providerId: string;
  name: string;
  domain: string;
  verified: boolean;
  protocol: "oidc" | "saml";
}
export interface SsoConnectionView extends SsoProviderView {
  workspaceName: string;
  workspaceSlug: string | null;
  available: boolean;
}
const pageNumber = (value: unknown, pages: number) =>
  (typeof value === "string" && /^\d{1,9}$/.test(value)) ||
  (typeof value === "number" && Number.isInteger(value))
    ? Math.max(1, Math.min(pages, Number(value)))
    : 1;
const publicProvider = {
  providerId: 1,
  domain: 1,
  displayName: 1,
  domainVerified: 1,
  protocol: {
    $cond: [
      { $ne: [{ $ifNull: ["$oidcConfig", null] }, null] },
      "oidc",
      "saml",
    ],
  },
};
function view(row: Document): SsoProviderView {
  return {
    id: String(row._id),
    providerId: String(row.providerId),
    name:
      typeof row.displayName === "string"
        ? row.displayName.slice(0, 64)
        : String(row.providerId),
    domain: typeof row.domain === "string" ? row.domain : "",
    verified: row.domainVerified === true,
    protocol: row.protocol === "oidc" ? "oidc" : "saml",
  };
}
export async function ssoProviderPage(
  db: Db,
  workspaceId: ObjectId,
  requestedPage: unknown,
  verifiedOnly = false,
) {
  const filter: Filter<Document> = {
    workspaceId,
    ...(verifiedOnly ? { domainVerified: true } : {}),
  };
  const total = await db
      .collection(physicalNames.sso_providers)
      .countDocuments(filter),
    pages = Math.max(1, Math.ceil(total / SSO_PAGE_SIZE)),
    page = pageNumber(requestedPage, pages);
  const rows = await db
    .collection(physicalNames.sso_providers)
    .aggregate([
      { $match: filter },
      { $sort: { _id: -1 } },
      { $skip: (page - 1) * SSO_PAGE_SIZE },
      { $limit: SSO_PAGE_SIZE },
      { $project: publicProvider },
    ])
    .toArray();
  return { rows: rows.map(view), total, page, pages };
}
export async function ssoConnectionPage(
  db: Db,
  userId: string,
  requestedPage: unknown,
) {
  const filter = { userId: { $in: [userId, new ObjectId(userId)] } };
  const total = await db
      .collection(physicalNames.sso_bindings)
      .countDocuments(filter),
    pages = Math.max(1, Math.ceil(total / SSO_PAGE_SIZE)),
    page = pageNumber(requestedPage, pages);
  const rows = await db
    .collection(physicalNames.sso_bindings)
    .aggregate([
      { $match: filter },
      { $sort: { _id: -1 } },
      { $skip: (page - 1) * SSO_PAGE_SIZE },
      { $limit: SSO_PAGE_SIZE },
      {
        $set: {
          providerObjectId: {
            $convert: {
              input: "$providerRecordId",
              to: "objectId",
              onError: null,
              onNull: null,
            },
          },
        },
      },
      {
        $lookup: {
          from: physicalNames.sso_providers,
          localField: "providerObjectId",
          foreignField: "_id",
          pipeline: [{ $project: publicProvider }],
          as: "provider",
        },
      },
      {
        $lookup: {
          from: physicalNames.workspaces,
          localField: "workspaceId",
          foreignField: "_id",
          pipeline: [
            {
              $project: { name: 1, slug: 1, personal: 1, platformFeatures: 1 },
            },
          ],
          as: "workspace",
        },
      },
      {
        $lookup: {
          from: physicalNames.subscriptions,
          localField: "workspaceId",
          foreignField: "workspaceId",
          pipeline: [
            {
              $match: {
                plan: "enterprise",
                status: { $in: ["active", "trialing", "past_due"] },
              },
            },
            { $limit: 1 },
            { $project: { _id: 1 } },
          ],
          as: "subscription",
        },
      },
      {
        $lookup: {
          from: physicalNames.workspace_members,
          localField: "workspaceId",
          foreignField: "workspaceId",
          pipeline: [
            {
              $match: {
                userId,
                role: { $in: ["owner", "admin", "member", "viewer"] },
              },
            },
            { $limit: 1 },
            { $project: { _id: 1 } },
          ],
          as: "member",
        },
      },
      {
        $project: {
          providerId: 1,
          providerRecordId: 1,
          provider: 1,
          workspace: 1,
          subscription: 1,
          member: 1,
        },
      },
    ])
    .toArray();
  return {
    rows: rows.map((row): SsoConnectionView => {
      const provider = row.provider[0],
        workspace = row.workspace[0];
      return {
        ...view(
          provider ?? { _id: row.providerRecordId, providerId: row.providerId },
        ),
        workspaceName:
          typeof workspace?.name === "string" ? workspace.name : "",
        workspaceSlug:
          typeof workspace?.slug === "string" ? workspace.slug : null,
        available:
          provider?.domainVerified === true &&
          workspace?.personal === false &&
          workspace?.platformFeatures?.advancedAuth === true &&
          row.member.length > 0 &&
          row.subscription.length > 0,
      };
    }),
    total,
    page,
    pages,
  };
}
