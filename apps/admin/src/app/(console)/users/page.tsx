import {
  accountSuspension,
  collection,
  physicalNames,
  type Documents,
} from "@shortn/db";
import type { Filter } from "mongodb";
import { DataTable, type Row } from "@/components/data-table";
import { Filters, FilterSearch, FilterSelect } from "@/components/filters";
import { PageBody, PageHeader } from "@/components/page";
import { Pager } from "@/components/pager";
import { Chip, Mono, Status } from "@/components/status";
import { fmtCount, fmtDate, fmtRelative } from "@/lib/format";
import { db } from "@/server/db";
import {
  boundedCount,
  choice,
  keysetPage,
  objectIdOrNull,
  param,
  prefixRegex,
  type SearchParams,
} from "@/server/list";
import { requireAdmin } from "@/server/session";

export const metadata = { title: "Users" };

type User = Documents["user"];

const roles = ["superadmin", "admin"] as const;
const statuses = ["banned", "deletion"] as const;

/** Every facet is index-backed (23 §2.3) except "verified", which scans in
 * `_id` order and stops at one page of matches. */
function userFilter(search: SearchParams): Filter<User> {
  const and: Filter<User>[] = [];
  const q = param(search, "q");
  if (q) {
    const id = objectIdOrNull(q);
    if (id) and.push({ _id: id });
    else if (q.includes("@") || /^[\w.+-]+$/.test(q))
      and.push({
        $or: [
          { email: prefixRegex(q.toLowerCase()) },
          { username: q },
          { sub: q },
        ],
      });
  }
  const role = choice(search, "role", roles);
  if (role) and.push({ role });
  const status = choice(search, "status", statuses);
  if (status === "banned") and.push({ banned: true });
  if (status === "deletion")
    and.push({ "deletion.purgeAfter": { $exists: true } });
  if (param(search, "twofa") === "on") and.push({ twoFactorEnabled: true });
  const verified = choice(search, "verified", ["yes", "no"] as const);
  if (verified === "yes") and.push({ emailVerified: true });
  if (verified === "no") and.push({ emailVerified: { $ne: true } });
  return and.length ? { $and: and } : {};
}

export default async function UsersPage({ searchParams }: PageProps<"/users">) {
  await requireAdmin();
  const search = await searchParams;
  const database = await db();
  const users = collection(database, "user");
  const filter = userFilter(search);
  const [page, count] = await Promise.all([
    keysetPage(users, filter, {
      after: param(search, "after"),
      before: param(search, "before"),
      projection: {
        email: 1,
        name: 1,
        role: 1,
        banned: 1,
        banExpires: 1,
        banReason: 1,
        deletion: 1,
        deletedAt: 1,
        emailVerified: 1,
        twoFactorEnabled: 1,
      },
    }),
    boundedCount(users, filter),
  ]);
  const ids = page.rows.map((user) => user._id.toHexString());
  const both = {
    $in: [...ids, ...page.rows.map((user) => user._id)],
  };
  const [passkeys, accounts, memberships, signIns] = await Promise.all([
    database
      .collection(physicalNames.passkeys)
      .aggregate<{ _id: string; count: number }>([
        { $match: { userId: both } },
        { $group: { _id: { $toString: "$userId" }, count: { $sum: 1 } } },
      ])
      .toArray(),
    database
      .collection(physicalNames.account)
      .aggregate<{ _id: string; providers: string[] }>([
        { $match: { userId: both } },
        {
          $group: {
            _id: { $toString: "$userId" },
            providers: { $addToSet: "$providerId" },
          },
        },
      ])
      .toArray(),
    collection(database, "workspace_members")
      .aggregate<{ _id: string; count: number }>([
        { $match: { userId: { $in: ids } } },
        { $group: { _id: "$userId", count: { $sum: 1 } } },
      ])
      .toArray(),
    collection(database, "sign_in_events")
      .aggregate<{ _id: string; at: Date }>([
        {
          $match: { userId: { $in: ids }, impersonatedBy: { $exists: false } },
        },
        { $sort: { userId: 1, at: -1 } },
        { $group: { _id: "$userId", at: { $first: "$at" } } },
      ])
      .toArray(),
  ]);
  const lookup = <T extends { _id: string }>(rows: T[]) =>
    new Map(rows.map((row) => [row._id, row]));
  const passkeysBy = lookup(passkeys);
  const accountsBy = lookup(accounts);
  const membershipsBy = lookup(memberships);
  const signInsBy = lookup(signIns);

  const now = new Date();
  const rows: Row[] = page.rows.map((user) => {
    const id = user._id.toHexString();
    const suspension = accountSuspension(user, now);
    return {
      id,
      href: `/users/${id}`,
      cells: {
        email: (
          <span title={user.name ? `${user.name} · ${user.email}` : user.email}>
            {user.email}
          </span>
        ),
        created: <Mono>{fmtDate(user._id.getTimestamp())}</Mono>,
        verified: user.emailVerified ? "Yes" : "No",
        role: user.role && user.role !== "user" ? <Chip>{user.role}</Chip> : "",
        status: suspension ? (
          suspension.kind === "deleted" ? (
            <Status tone="danger">Pending deletion</Status>
          ) : (
            <Status tone="danger" title={user.banReason ?? undefined}>
              {user.banExpires
                ? `Banned until ${fmtDate(user.banExpires)}`
                : "Banned"}
            </Status>
          )
        ) : (
          <Status tone="success">Active</Status>
        ),
        twofa:
          [
            user.twoFactorEnabled ? "TOTP" : null,
            passkeysBy.get(id)?.count
              ? `${passkeysBy.get(id)?.count} passkey`
              : null,
          ]
            .filter(Boolean)
            .join(" · ") || "—",
        methods: accountsBy.get(id)?.providers.sort().join(", ") || "—",
        workspaces: <Mono>{membershipsBy.get(id)?.count ?? 0}</Mono>,
        lastSignIn: <Mono>{fmtRelative(signInsBy.get(id)?.at, now)}</Mono>,
      },
    };
  });

  const applied = [
    param(search, "q") ? `Search: ${param(search, "q")}` : null,
    choice(search, "role", roles) ? `Role: ${param(search, "role")}` : null,
    choice(search, "status", statuses)
      ? `Status: ${param(search, "status")}`
      : null,
    param(search, "twofa") === "on" ? "2FA enrolled" : null,
    param(search, "verified") ? `Verified: ${param(search, "verified")}` : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <>
      <PageHeader title="Users" count={fmtCount(count)} />
      <PageBody>
        <Filters applied={applied}>
          <FilterSearch
            label="Search"
            placeholder="Email prefix, user ID, username or sub"
          />
          <FilterSelect
            label="Role"
            name="role"
            options={roles.map((value) => ({ value, label: value }))}
          />
          <FilterSelect
            label="Status"
            name="status"
            options={[
              { value: "banned", label: "Banned" },
              { value: "deletion", label: "Pending deletion" },
            ]}
          />
          <FilterSelect
            label="2FA"
            name="twofa"
            options={[{ value: "on", label: "TOTP enrolled" }]}
          />
          <FilterSelect
            label="Verified"
            name="verified"
            options={[
              { value: "yes", label: "Verified" },
              { value: "no", label: "Unverified" },
            ]}
          />
        </Filters>
        <DataTable
          caption="Users"
          columns={[
            { id: "email", header: "Email" },
            { id: "created", header: "Created" },
            { id: "verified", header: "Verified" },
            { id: "role", header: "Role" },
            { id: "status", header: "Status" },
            { id: "twofa", header: "2FA" },
            { id: "methods", header: "Sign-in methods" },
            { id: "workspaces", header: "Workspaces", align: "right" },
            { id: "lastSignIn", header: "Last sign-in" },
          ]}
          rows={rows}
          empty="No users match these filters."
        />
        <Pager search={search} next={page.next} prev={page.prev} />
      </PageBody>
    </>
  );
}
