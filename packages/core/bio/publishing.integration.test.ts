import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { physicalNames, syncIndexes, legacyCollectionKeys } from "@shortn/db";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { Redis } from "ioredis";
import { ensurePersonalWorkspace } from "../workspaces/service";
import type { ServiceContext } from "../workspaces/context";
import { createLink } from "../links/service";
import { addLinksToBioDraft } from "./add-links";
import { groupBioLinks, newBioLinksSection } from "./content";
import { createBioPage } from "./service";
import { bioPresets, migratedBioContent } from "./content";
import {
  publicBioFromDocument,
  bioVersions,
  changeBioHandle,
  ownedBioDocument,
  publishBioDraft,
  readBioDraft,
  resolveBioDocument,
  restoreBioVersion,
  saveBioDraft,
} from "./publishing";
import {
  activeDomain,
  addDomain,
  assignDomainLink,
  domainAllowance,
  listDomains,
  moveDomainLinks,
  pollDomains,
  removeDomain,
  type DomainProvider,
  type HostnameState,
} from "../domains/service";
import { mongoLinkLoader } from "../../../apps/redirect/src/resolver";
import { receiveBioView } from "../../../apps/api/src/bio-views";
import { ingestBioViews } from "../../../apps/worker/src/bio-views";
const mongoUrl = process.env.MONGO_TEST_URL,
  redisUrl = process.env.REDIS_TEST_URL;
(mongoUrl && redisUrl ? describe : describe.skip)(
  "P5 publishing and domain lifecycle",
  () => {
    let client: MongoClient,
      db: Db,
      redis: Redis,
      ctx: ServiceContext,
      pageId: string;
    beforeAll(async () => {
      if (!/^mongodb:\/\/(localhost|127\.0\.0\.1):/.test(mongoUrl!))
        throw new Error("P5 integration tests require loopback MongoDB");
      client = await new MongoClient(mongoUrl!).connect();
      db = client.db(
        `shortn_p5_test_${crypto.randomUUID().replaceAll("-", "")}`,
      );
      redis = new Redis(redisUrl!);
      for (const key of legacyCollectionKeys)
        await db.createCollection(physicalNames[key]);
      await syncIndexes(db);
      const userId = new ObjectId().toHexString(),
        workspace = await ensurePersonalWorkspace(db, {
          id: userId,
          email: "p5@example.com",
          name: "P5",
          sub: `p5|${userId}`,
        });
      ctx = {
        db,
        workspace,
        actor: { userId, role: "owner" },
        cache: redis,
        linkDomain: "shortn.at",
      };
      const created = await createBioPage(ctx, {
        slug: "p5-test",
        title: "São João — edición",
      });
      if (!created.ok) throw new Error(created.error);
      pageId = created.value.id;
    }, 30_000);
    afterAll(async () => {
      await db?.dropDatabase();
      await client?.close();
      redis?.disconnect();
    });
    test("new pages are drafts; concurrent saves converge; publication is atomic", async () => {
      expect(await resolveBioDocument(db, "p5-test")).toBeNull();
      const draft = await readBioDraft(ctx, pageId);
      if (!draft) throw new Error("missing draft");
      const input = { ...draft.content, theme: bioPresets.forest! };
      const results = await Promise.all([
        saveBioDraft(ctx, pageId, 0, input),
        saveBioDraft(ctx, pageId, 0, { ...input, theme: bioPresets.ink! }),
      ]);
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(
        results.filter((r) => !r.ok && r.error === "conflict"),
      ).toHaveLength(1);
      expect(await resolveBioDocument(db, "p5-test")).toBeNull();
      expect((await publishBioDraft(ctx, pageId, 1)).ok).toBe(true);
      const page = await resolveBioDocument(db, "p5-test");
      expect(page?.publishedRevision).toBe(1);
      expect(
        await db
          .collection(physicalNames.bio_delivery_jobs)
          .countDocuments({ bioPageId: new ObjectId(pageId) }),
      ).toBe(1);
    });
    test("adding library links targets sections, deduplicates and preserves publication", async () => {
      const fixtureId = new ObjectId();
      await db.collection(physicalNames.bio_pages).insertOne({
        ...(await ownedBioDocument(ctx, pageId))!,
        _id: fixtureId,
        slug: "bio-add-target",
        handle: "bio-add-target",
        draftRevision: 0,
        publishedRevision: 0,
        published: false,
      });
      const id = fixtureId.toHexString();
      const a = await createLink(ctx, {
        url: "https://example.com/first",
        title: "First",
      });
      const b = await createLink(ctx, {
        url: "https://example.com/second",
        title: "Second",
      });
      if (!a.ok || !b.ok) throw new Error("missing links");
      const first = await addLinksToBioDraft(ctx, id, {
        revision: 0,
        ids: [a.value.id],
        sectionTitle: "Articles",
      });
      expect(first.ok).toBe(true);
      if (!first.ok) throw new Error(first.error);
      const sectionId = first.value.sectionId;
      const added = await addLinksToBioDraft(ctx, id, {
        revision: 1,
        ids: [a.value.id, b.value.id, b.value.id],
        sectionId,
        image: "https://cdn.example.com/second.png",
      });
      expect(added).toMatchObject({
        ok: true,
        value: { added: 1, skipped: 1, sectionId },
      });
      const draft = (await readBioDraft(ctx, id))!;
      const section = draft.content.blocks.find(
        (block) => block.id === sectionId,
      );
      expect(section).toMatchObject({
        type: "links",
        title: "Articles",
        items: [
          { linkId: a.value.id, image: "" },
          { linkId: b.value.id, image: "https://cdn.example.com/second.png" },
        ],
      });
      expect(
        section?.type === "links" &&
          section.items.every((item) => item.addedAt),
      ).toBe(true);
      expect(draft.published).toBe(false);
      expect(
        await addLinksToBioDraft(ctx, id, {
          revision: 1,
          ids: [a.value.id],
          sectionId,
        }),
      ).toMatchObject({ ok: false, error: "conflict" });
      expect(
        await addLinksToBioDraft(ctx, id, {
          revision: 2,
          ids: [a.value.id],
          sectionId: "missing",
        }),
      ).toMatchObject({ ok: false, error: "section_not_found" });
      const viewer = {
        ...ctx,
        actor: { ...ctx.actor, role: "viewer" as const },
      };
      expect(
        await addLinksToBioDraft(viewer, id, {
          revision: 2,
          ids: [a.value.id],
          sectionId,
        }),
      ).toMatchObject({ ok: false, error: "forbidden" });
      const foreign = new ObjectId();
      await db.collection(physicalNames.links).insertOne({
        _id: foreign,
        workspaceId: new ObjectId(),
        title: "Foreign",
      });
      expect(
        await addLinksToBioDraft(ctx, id, {
          revision: 2,
          ids: [foreign.toHexString()],
          sectionId,
        }),
      ).toMatchObject({ ok: false, error: "link_not_found" });
      // Bulk appends must fail atomically if the section has no remaining capacity.
      const full = groupBioLinks(draft.content);
      full.blocks.push({
        ...newBioLinksSection("full"),
        items: Array.from({ length: 1000 }, (_, index) => ({
          id: `full-${index}`,
          linkId: a.value.id,
          title: "",
          visible: true,
          image: "",
          highlight: false,
        })),
      });
      expect((await saveBioDraft(ctx, id, 2, full)).ok).toBe(true);
      expect(
        await addLinksToBioDraft(ctx, id, {
          revision: 3,
          ids: [b.value.id],
          sectionId: "full",
        }),
      ).toMatchObject({ ok: false, error: "limit_reached" });
      expect((await readBioDraft(ctx, id))!.revision).toBe(3);
      const duplicates = await addLinksToBioDraft(ctx, id, {
        revision: 3,
        ids: [a.value.id],
        sectionId,
      });
      expect(duplicates).toMatchObject({
        ok: true,
        value: { added: 0, skipped: 1 },
      });
      expect((await readBioDraft(ctx, id))!.revision).toBe(3);
    });
    test("permissions, workspace isolation and free-plan scheduling are checked on the service", async () => {
      const draft = await readBioDraft(ctx, pageId);
      if (!draft) throw new Error("missing draft");
      const viewer = {
        ...ctx,
        actor: { ...ctx.actor, role: "viewer" as const },
      };
      expect(
        await saveBioDraft(viewer, pageId, draft.revision, draft.content),
      ).toMatchObject({ ok: false, error: "forbidden" });
      expect(
        await ownedBioDocument(
          {
            ...ctx,
            workspace: {
              ...ctx.workspace,
              _id: new ObjectId(),
              personal: false,
            },
          },
          pageId,
        ),
      ).toBeNull();
      expect(
        await saveBioDraft(ctx, pageId, draft.revision, {
          ...draft.content,
          hideBranding: true,
        }),
      ).toMatchObject({ ok: false, error: "feature_required" });
      const foreignId = new ObjectId();
      await db.collection(physicalNames.links).insertOne({
        _id: foreignId,
        workspaceId: new ObjectId(),
        urlCode: "foreign",
        longUrl: "https://example.com",
      });
      expect(
        await saveBioDraft(ctx, pageId, draft.revision, {
          ...draft.content,
          blocks: [
            ...draft.content.blocks,
            {
              id: "foreign",
              visible: true,
              type: "link",
              linkId: String(foreignId),
              title: "foreign",
            },
          ],
        }),
      ).toMatchObject({ ok: false, error: "link_not_found" });
    });
    test("nested collections batch ownership checks and retain hundreds of references on publish and restore", async () => {
      const directoryId = new ObjectId();
      await db.collection(physicalNames.bio_pages).insertOne({
        _id: directoryId,
        workspaceId: ctx.workspace._id,
        handle: "p5-directory-test",
        published: false,
        draft: migratedBioContent({ title: "Directory" }),
        draftRevision: 0,
      });
      const created = { value: { id: String(directoryId) } };
      const draft = (await readBioDraft(ctx, created.value.id))!;
      const ids = Array.from({ length: 250 }, () => new ObjectId());
      await db.collection(physicalNames.links).insertMany(
        ids.map((_id, i) => ({
          _id,
          workspaceId: ctx.workspace._id,
          urlCode: `resource-${i}`,
          domain: "shortn.at",
          longUrl: `https://example.com/${i}`,
          title: `Resource ${i}`,
        })),
      );
      const section = {
        id: "resources",
        type: "links",
        visible: true,
        title: "Resources",
        layout: "paginated",
        pageSize: 10,
        items: ids.map((_id, i) => ({
          id: `item-${i}`,
          visible: true,
          linkId: String(_id),
          title: `Resource ${i}`,
          image: "",
          highlight: false,
        })),
      };
      const input = {
        ...draft.content,
        blocks: [...draft.content.blocks, section],
      };
      const foreign = new ObjectId();
      await db.collection(physicalNames.links).insertOne({
        _id: foreign,
        workspaceId: new ObjectId(),
        urlCode: "foreign-nested",
        longUrl: "https://example.com",
      });
      expect(
        await saveBioDraft(ctx, draft.id, draft.revision, {
          ...input,
          blocks: [
            ...draft.content.blocks,
            {
              ...section,
              items: [{ ...section.items[0], linkId: String(foreign) }],
            },
          ],
        }),
      ).toMatchObject({ ok: false, error: "link_not_found" });
      expect(
        await saveBioDraft(ctx, draft.id, draft.revision, {
          ...input,
          blocks: [
            ...draft.content.blocks,
            {
              ...section,
              items: [
                {
                  ...section.items[0],
                  schedule: { from: "2026-10-12T10:00:00Z" },
                },
              ],
            },
          ],
        }),
      ).toMatchObject({ ok: false, error: "feature_required" });
      const saved = await saveBioDraft(ctx, draft.id, draft.revision, input);
      if (!saved.ok) throw new Error(saved.error);
      expect(
        (await publishBioDraft(ctx, draft.id, saved.value.revision)).ok,
      ).toBe(true);
      const page = (await ownedBioDocument(ctx, draft.id))!;
      const publicPage = await publicBioFromDocument(
        db,
        page,
        "https://shortn.at",
        false,
      );
      expect(Object.keys(publicPage.links)).toHaveLength(250);
      expect(
        publicPage.content.blocks.find((b) => b.type === "links"),
      ).toMatchObject({ type: "links", layout: "paginated", pageSize: 10 });
      expect(
        (
          await restoreBioVersion(
            ctx,
            draft.id,
            saved.value.revision,
            saved.value.revision,
          )
        ).ok,
      ).toBe(true);
      expect(
        (await readBioDraft(ctx, draft.id))?.content.blocks.find(
          (b) => b.type === "links",
        ),
      ).toEqual(publicPage.content.blocks.find((b) => b.type === "links"));
      await db
        .collection(physicalNames.bio_pages)
        .deleteOne({ _id: directoryId });
    });
    test("last twenty publications restore to a draft without changing the public version", async () => {
      for (let at = 0; at < 21; at++) {
        const draft = await readBioDraft(ctx, pageId);
        if (!draft) throw new Error("missing");
        const saved = await saveBioDraft(ctx, pageId, draft.revision, {
          ...draft.content,
          seo: { ...draft.content.seo, title: `Version ${at}` },
        });
        if (!saved.ok) throw new Error(saved.error);
        expect(
          (await publishBioDraft(ctx, pageId, saved.value.revision)).ok,
        ).toBe(true);
      }
      const versions = await bioVersions(ctx, pageId);
      expect(versions).toHaveLength(20);
      const draft = await readBioDraft(ctx, pageId);
      if (!draft) throw new Error("missing");
      expect(
        (
          await restoreBioVersion(
            ctx,
            pageId,
            draft.revision,
            versions.at(-1)!.revision,
          )
        ).ok,
      ).toBe(true);
      expect(
        (await resolveBioDocument(db, "p5-test"))?.publishedContent.seo.title,
      ).toBe("Version 20");
    });
    test("aliases point to the page after handle changes, including grandfathered labels", async () => {
      expect((await changeBioHandle(ctx, pageId, "p5-new")).ok).toBe(true);
      expect(String((await resolveBioDocument(db, "p5-test"))?._id)).toBe(
        pageId,
      );
      expect((await resolveBioDocument(db, "p5-test"))?.handle).toBe("p5-new");
      await db.collection(physicalNames.bio_pages).insertOne({
        handle: "a",
        published: true,
        blocks: migratedBioContent({ title: "A" }).blocks,
      });
      expect((await resolveBioDocument(db, "a"))?.handle).toBe("a");
    });
    test("hostname provisioning requires an add-on and both hostname and TLS readiness", async () => {
      expect(await domainAllowance(db, ctx.workspace._id)).toBe(0);
      expect(
        await addDomain(
          ctx,
          { hostname: "go.example.com", kind: "links" },
          "shortn.at",
        ),
      ).toMatchObject({ ok: false, error: "addon_required" });
      await db.collection(physicalNames.subscriptions).insertOne({
        workspaceId: ctx.workspace._id,
        status: "active",
        plan: "pro",
        polarSubscriptionId: "plan",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 86400000),
      });
      await db.collection(physicalNames.domain_addons).insertOne({
        workspaceId: ctx.workspace._id,
        polarSubscriptionId: "addon",
        status: "active",
      });
      const added = await addDomain(
        ctx,
        { hostname: "go.example.com", kind: "both", bioPageId: pageId },
        "shortn.at",
      );
      expect(added.ok).toBe(true);
      let remote: HostnameState = {
        id: "cf-fixture",
        status: "active",
        ssl: { status: "pending_validation" },
      };
      let provisioned = false;
      const provider: DomainProvider = {
        find: async () => (provisioned ? remote : null),
        add: async () => {
          provisioned = true;
          return remote;
        },
        get: async () => remote,
        remove: async () => {},
      };
      const now = new Date(Date.now() + 1000);
      await pollDomains(db, provider, now);
      expect(await activeDomain(db, "go.example.com")).toBeNull();
      remote = { ...remote, ssl: { status: "active" } };
      await pollDomains(db, provider, new Date(now.getTime() + 120000));
      expect((await activeDomain(db, "go.example.com"))?.hostname).toBe(
        "go.example.com",
      );
      const domain = (await listDomains(ctx))[0]!;
      const root = new ObjectId(),
        custom = new ObjectId();
      await db.collection(physicalNames.links).insertMany([
        {
          _id: root,
          workspaceId: ctx.workspace._id,
          urlCode: "sale",
          key: "sale",
          domain: "shortn.at",
          longUrl: "https://root.example.com",
        },
        {
          _id: custom,
          workspaceId: ctx.workspace._id,
          key: "sale",
          domain: domain.hostname,
          longUrl: "https://custom.example.com",
        },
      ]);
      const loader = mongoLinkLoader(db);
      expect(await loader("go.example.com", "sale")).toMatchObject({
        kind: "link",
        id: String(custom),
      });
      expect(await loader("shortn.at", "sale")).toMatchObject({
        kind: "link",
        id: String(root),
      });
      const assignable = new ObjectId();
      await db.collection(physicalNames.links).insertOne({
        _id: assignable,
        workspaceId: ctx.workspace._id,
        key: "move-me",
        domain: "shortn.at",
        longUrl: "https://example.com",
      });
      expect(
        (await assignDomainLink(ctx, domain.id, String(assignable))).ok,
      ).toBe(true);
      expect(await loader("go.example.com", "move-me")).toMatchObject({
        kind: "link",
        id: String(assignable),
      });
      expect(
        await assignDomainLink(
          { ...ctx, actor: { ...ctx.actor, role: "viewer" } },
          domain.id,
          String(assignable),
        ),
      ).toMatchObject({ ok: false, error: "forbidden" });
      const sameKey = await createLink(ctx, {
        domain: domain.hostname,
        key: "shared-key",
        url: "https://custom.example.com",
      });
      const rootKey = await createLink(ctx, {
        key: "shared-key",
        url: "https://root.example.com",
      });
      expect(sameKey.ok).toBe(true);
      expect(rootKey.ok).toBe(true);
      expect(
        await createLink(
          { ...ctx, workspace: { ...ctx.workspace, _id: new ObjectId() } },
          { domain: domain.hostname, url: "https://example.com" },
        ),
      ).toMatchObject({ ok: false, error: "forbidden" });
      await removeDomain(ctx, domain.id);
      expect(await activeDomain(db, domain.hostname)).toBeNull();
      expect(
        (await db.collection(physicalNames.links).findOne({ _id: custom }))
          ?.domainInactive,
      ).toBe(true);
      const recovered = await moveDomainLinks(ctx, domain.id);
      expect(recovered.ok).toBe(true);
      if (recovered.ok) {
        expect(recovered.value.moved).toEqual(["move-me"]);
        expect(recovered.value.conflicts.sort()).toEqual([
          "sale",
          "shared-key",
        ]);
      }
    });
    test("bio view ingestion is isolated, idempotent and rejects foreign origins", async () => {
      const messages: string[][] = [];
      const durable = {
        eval: async () => 1,
        set: async () => "OK",
        xadd: async (...args: unknown[]) => {
          messages.push(args.slice(2).map(String));
          return "1000-0";
        },
      } as unknown as Parameters<typeof receiveBioView>[1]["durable"];
      const deps = {
        db,
        durable,
        secret: "test",
        rootOrigin: "https://shortn.at",
        subdomains: true,
      };
      const request = (origin: string) =>
        new Request("https://api.shortn.at/v1/bio/view", {
          method: "POST",
          headers: {
            origin,
            "user-agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
            "cf-connecting-ip": "203.0.113.1",
          },
          body: JSON.stringify({
            pageId,
            referrer: "https://publisher.example/article?secret=discard",
          }),
        });
      expect(
        (await receiveBioView(request("https://evil.example"), deps)).status,
      ).toBe(403);
      expect(
        (await receiveBioView(request("https://p5-new.shortn.at"), deps))
          .status,
      ).toBe(204);
      expect(messages).toHaveLength(1);
      const before = await db
        .collection(physicalNames.click_events)
        .countDocuments({});
      await ingestBioViews(db, [
        ["1000-0", messages[0]!],
        ["1000-0", messages[0]!],
      ]);
      expect(
        await db.collection(physicalNames.bio_views).countDocuments({}),
      ).toBe(1);
      expect(
        await db.collection(physicalNames.click_events).countDocuments({}),
      ).toBe(before);
      const stored = await db.collection(physicalNames.bio_views).findOne({});
      expect(stored?.refDomain).toBe("publisher.example");
      expect(stored?.ip).toBeUndefined();
    });
  },
);
