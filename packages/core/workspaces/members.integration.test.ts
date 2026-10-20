import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { physicalNames } from "@shortn/db";
import { Redis } from "ioredis";
import { MongoClient, ObjectId, type Db } from "mongodb";
import {
  createBioPage,
  getBioPage,
  setBioLinks,
  updateBioPage,
} from "../bio/service";
import { createLink } from "../links/service";
import type { Role } from "./authz";
import type { ServiceContext } from "./context";
import {
  acceptInvite,
  changeRole,
  createWorkspace,
  deleteWorkspace,
  inviteMember,
  listMembers,
  removeMember,
} from "./members";
import {
  ensurePersonalWorkspace,
  workspaceContext,
  type Workspace,
} from "./service";

const mongoUrl = process.env.MONGO_TEST_URL;
const redisUrl = process.env.REDIS_TEST_URL;

(mongoUrl && redisUrl ? describe : describe.skip)(
  "members, workspaces and bio pages",
  () => {
    let client: MongoClient;
    let redis: Redis;
    let db: Db;

    beforeAll(async () => {
      client = await new MongoClient(mongoUrl ?? "").connect();
      redis = new Redis(redisUrl ?? "");
      db = client.db(
        `shortn_core_test_${crypto.randomUUID().replaceAll("-", "")}`,
      );
    });
    afterAll(async () => {
      await db?.dropDatabase();
      await client?.close();
      redis?.disconnect();
    });

    async function user(email: string, plan?: "plus" | "pro") {
      const id = new ObjectId();
      await db
        .collection(physicalNames.user)
        .insertOne({ _id: id, email, name: email.split("@")[0] });
      const workspace = await ensurePersonalWorkspace(db, {
        id: id.toHexString(),
        name: "x",
        email,
        sub: `authS|${id}`,
      });
      if (plan)
        await db.collection(physicalNames.subscriptions).insertOne({
          workspaceId: workspace._id,
          polarSubscriptionId: crypto.randomUUID(),
          status: "active",
          plan,
          currentPeriodStart: new Date(Date.now() - 86_400_000),
          currentPeriodEnd: new Date(Date.now() + 29 * 86_400_000),
          cancelAtPeriodEnd: false,
        });
      return { id: id.toHexString(), email, workspace };
    }

    const ctx = (
      workspace: Workspace,
      userId: string,
      role: Role,
    ): ServiceContext => ({
      db,
      workspace,
      actor: { userId, role },
      cache: redis,
      linkDomain: "shortn.at",
    });

    test("team workspace: invite within seats, bound to the email, roles enforced", async () => {
      const owner = await user(`o-${crypto.randomUUID()}@x.com`, "plus");
      const freeOwner = await user(`f-${crypto.randomUUID()}@x.com`);
      expect(
        await createWorkspace(db, freeOwner, {
          name: "T",
          slug: `t-${crypto.randomUUID().slice(0, 8)}`,
        }),
      ).toMatchObject({
        error: "limit_reached",
      });
      const created = await createWorkspace(db, owner, {
        name: "Team",
        slug: `team-${crypto.randomUUID().slice(0, 8)}`,
      });
      if (!created.ok) throw new Error(created.error);
      const team = created.value;
      await db.collection(physicalNames.subscriptions).insertOne({
        workspaceId: team._id,
        polarSubscriptionId: crypto.randomUUID(),
        status: "active",
        plan: "plus",
        currentPeriodStart: new Date(Date.now() - 86_400_000),
        currentPeriodEnd: new Date(Date.now() + 29 * 86_400_000),
        cancelAtPeriodEnd: false,
      });
      const asOwner = ctx(team, owner.id, "owner");
      const member = await user(`m-${crypto.randomUUID()}@x.com`);
      const invited = await inviteMember(asOwner, {
        email: member.email.toUpperCase(),
        role: "member",
      });
      if (!invited.ok) throw new Error(invited.error);
      const again = await inviteMember(asOwner, {
        email: member.email,
        role: "viewer",
      });
      expect(again.ok).toBe(true);
      await inviteMember(asOwner, {
        email: `x-${crypto.randomUUID()}@x.com`,
        role: "viewer",
      });
      expect(
        await inviteMember(asOwner, {
          email: `y-${crypto.randomUUID()}@x.com`,
          role: "viewer",
        }),
      ).toMatchObject({
        error: "seats_exhausted",
      });
      expect(await acceptInvite(db, invited.value.token, member)).toMatchObject(
        { error: "invite_invalid" },
      );
      if (!again.ok) throw new Error(again.error);
      const stranger = await user(`s-${crypto.randomUUID()}@x.com`);
      expect(await acceptInvite(db, again.value.token, stranger)).toMatchObject(
        { error: "invite_email_mismatch" },
      );
      expect((await acceptInvite(db, again.value.token, member)).ok).toBe(true);
      expect(await acceptInvite(db, again.value.token, member)).toMatchObject({
        error: "invite_invalid",
      });
      const context = await workspaceContext(db, member.id, team.slug);
      expect(context?.actor.role).toBe("viewer");
      expect((await listMembers(asOwner)).map((m) => m.role)).toEqual([
        "owner",
        "viewer",
      ]);

      const asViewer = ctx(team, member.id, "viewer");
      expect(
        await createLink(asViewer, { url: "https://a.com" }),
      ).toMatchObject({ error: "forbidden" });
      expect(
        await inviteMember(asViewer, { email: "z@x.com", role: "viewer" }),
      ).toMatchObject({ error: "forbidden" });
      expect(
        await changeRole(ctx(team, member.id, "admin"), member.id, "admin"),
      ).toMatchObject({ error: "forbidden" });
      expect((await changeRole(asOwner, member.id, "member")).ok).toBe(true);
      expect(await removeMember(asOwner, owner.id)).toMatchObject({
        error: "owner_protected",
      });
      expect(
        (await removeMember(ctx(team, member.id, "member"), member.id)).ok,
      ).toBe(true);

      const link = await createLink(asOwner, { url: "https://a.com" });
      expect(link.ok).toBe(true);
      expect(await deleteWorkspace(asOwner)).toMatchObject({
        error: "not_empty",
      });
    });

    test("a comp lets a free owner create a team workspace and never blocks deleting it", async () => {
      const owner = await user(`c-${crypto.randomUUID()}@x.com`);
      const slug = () => `comp-${crypto.randomUUID().slice(0, 8)}`;
      expect(
        await createWorkspace(db, owner, { name: "T", slug: slug() }),
      ).toMatchObject({ error: "limit_reached" });
      const grant = {
        reason: "partner",
        grantedBy: "staff",
        grantedAt: new Date(),
      };
      await db
        .collection(physicalNames.workspaces)
        .updateOne(
          { _id: owner.workspace._id },
          { $set: { entitlementOverride: { ...grant, plan: "pro" } } },
        );
      const created = await createWorkspace(db, owner, {
        name: "Comped team",
        slug: slug(),
      });
      if (!created.ok) throw new Error(created.error);
      await db
        .collection(physicalNames.workspaces)
        .updateOne(
          { _id: created.value._id },
          { $set: { entitlementOverride: { ...grant, plan: "enterprise" } } },
        );
      const team = (await db
        .collection<Workspace>(physicalNames.workspaces)
        .findOne({ _id: created.value._id }))!;
      expect((await deleteWorkspace(ctx(team, owner.id, "owner"))).ok).toBe(
        true,
      );
    });

    test("bio pages: legacy-shaped writes, slug rules, owned links only", async () => {
      const owner = await user(`b-${crypto.randomUUID()}@x.com`);
      const c = ctx(owner.workspace, owner.id, "owner");
      const slug = `page-${crypto.randomUUID().slice(0, 8)}`;
      expect(await createBioPage(c, { slug: "Has Space" })).toMatchObject({
        error: "invalid_slug",
      });
      const link = await createLink(c, {
        url: "https://a.com",
        title: "First",
      });
      if (!link.ok) throw new Error(link.error);
      const page = await createBioPage(c, { slug, linkId: link.value.id });
      if (!page.ok) throw new Error(page.error);
      expect(await createBioPage(c, { slug: `${slug}-2` })).toMatchObject({
        error: "limit_reached",
      });
      const doc = await db
        .collection(physicalNames.bio_pages)
        .findOne({ slug });
      expect(doc?.userId).toBe(owner.workspace.legacySub);
      expect(doc?.links[0].link).toEqual(new ObjectId(link.value.id));

      expect(
        await updateBioPage(c, page.value.id, {
          theme: { primaryColor: "javascript:x" },
        }),
      ).toMatchObject({
        error: "invalid_input",
      });
      expect(
        (
          await updateBioPage(c, page.value.id, {
            title: "Hi",
            theme: { primaryColor: "#0f172b", buttonStyle: "pill" },
            socials: [
              { platform: "instagram", url: "https://instagram.com/x" },
            ],
          })
        ).ok,
      ).toBe(true);
      const other = await user(`o-${crypto.randomUUID()}@x.com`);
      const foreign = await createLink(
        ctx(other.workspace, other.id, "owner"),
        { url: "https://b.com" },
      );
      if (!foreign.ok) throw new Error(foreign.error);
      expect(
        await setBioLinks(c, page.value.id, [{ linkId: foreign.value.id }]),
      ).toMatchObject({
        error: "link_not_found",
      });
      expect(
        (
          await setBioLinks(c, page.value.id, [
            { linkId: link.value.id, title: "Renamed" },
          ])
        ).ok,
      ).toBe(true);
      const editable = await getBioPage(c, page.value.id);
      expect(editable?.links).toEqual([
        {
          linkId: link.value.id,
          title: "Renamed",
          image: null,
          key: link.value.key,
          url: "https://a.com",
        },
      ]);
      expect(editable?.theme.buttonStyle).toBe("pill");
    });
  },
);
