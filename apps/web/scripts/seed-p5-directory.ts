/** Additional synthetic large-collection fixture for the local P5 sandbox. */
import { readFile, writeFile } from "node:fs/promises";
import { MongoClient, ObjectId } from "mongodb";
import { Redis } from "ioredis";
import { physicalNames } from "@shortn/db";
import {
  createBioPage,
  ensureTags,
  readBioDraft,
  saveBioDraft,
  publishBioDraft,
  type ServiceContext,
} from "@shortn/core";
const credentials = JSON.parse(
  await readFile("/tmp/shortn-p5-login.json", "utf8"),
);
if (new URL(credentials.editor).origin !== "http://localhost:3100")
  throw new Error("Local fixture only");
const client = await new MongoClient(
  "mongodb://127.0.0.1:27020/?replicaSet=rs0",
).connect();
const db = client.db("shortn_p5_dev"),
  cache = new Redis("redis://127.0.0.1:16380/5");
try {
  const workspace = await db
    .collection(physicalNames.workspaces)
    .findOne({ slug: new URL(credentials.editor).pathname.split("/")[1] });
  const user = await db
    .collection(physicalNames.user)
    .findOne({ email: credentials.email });
  if (!workspace || !user) throw new Error("Start dev:p5 first");
  const ctx = {
    db,
    cache,
    workspace,
    actor: { userId: String(user._id), role: "owner" },
    linkDomain: "localhost:3102",
  } as unknown as ServiceContext;
  const now = new Date();
  const resourceTags = await ensureTags(ctx, [
    "Product",
    "Marketing",
    "Support",
  ]);
  await db.collection(physicalNames.links).bulkWrite(
    Array.from({ length: 125 }, (_, at) => {
      const key = `p5-resource-${String(at + 1).padStart(3, "0")}`;
      return {
        updateOne: {
          filter: { workspaceId: workspace._id, key },
          update: {
            $setOnInsert: {
              workspaceId: workspace._id,
              key,
              urlCode: key,
              domain: "localhost:3102",
              title: `Sample resource ${String(at + 1).padStart(3, "0")}`,
              longUrl: `https://example.com/resources/${at + 1}`,
              hidden: true,
              safetyStatus: "safe",
              requiresInterstitial: false,
              date: now,
              createdAt: now,
            },
          },
          upsert: true,
        },
      };
    }),
  );
  const resources = await db
    .collection(physicalNames.links)
    .find({ workspaceId: workspace._id, key: /^p5-resource-/ })
    .sort({ key: 1 })
    .toArray();
  // Give synthetic resources useful picker filters without replacing edited tags.
  await db.collection(physicalNames.links).bulkWrite(
    resources.map((link, at) => {
      const tag = resourceTags[at % resourceTags.length]!;
      return {
        updateOne: {
          filter: { _id: link._id, "tags.0": { $exists: false } },
          update: {
            $set: {
              tags: [
                { _id: tag._id, id: tag.id, tagName: tag.name, name: tag.name },
              ],
              tagIds: [tag._id],
            },
          },
        },
      };
    }),
  );
  let page = await db
    .collection(physicalNames.bio_pages)
    .findOne({ workspaceId: workspace._id, handle: "p5-directory" });
  if (!page) {
    const result = await createBioPage(ctx, {
      slug: "p5-directory",
      title: "Studio resource directory",
    });
    if (!result.ok) throw new Error(result.error);
    const draft = (await readBioDraft(ctx, result.value.id))!;
    const saved = await saveBioDraft(ctx, result.value.id, draft.revision, {
      ...draft.content,
      blocks: [
        draft.content.blocks[0],
        {
          id: "directory-intro",
          visible: true,
          type: "text",
          text: "Synthetic demo: 125 sample resources for testing search, pagination and visual editing.",
        },
        {
          id: "directory-links",
          visible: true,
          type: "links",
          title: "Resources",
          layout: "paginated",
          pageSize: 10,
          items: resources.map((link) => ({
            id: `resource-${link.key}`,
            visible: true,
            linkId: String(link._id),
            title: link.title,
            image: "",
            highlight: false,
          })),
        },
        {
          id: "directory-footer",
          visible: true,
          type: "header",
          text: "Made for testing",
        },
      ],
    });
    if (!saved.ok) throw new Error(saved.error);
    const published = await publishBioDraft(
      ctx,
      result.value.id,
      saved.value.revision,
    );
    if (!published.ok) throw new Error(published.error);
    page = await db
      .collection(physicalNames.bio_pages)
      .findOne({ _id: new ObjectId(result.value.id) });
  }
  credentials.directoryEditor = `http://localhost:3100/${workspace.slug}/bio/${page!._id}/editor`;
  credentials.directoryBio = "http://localhost:3100/_bio/p5-directory";
  await writeFile(
    "/tmp/shortn-p5-login.json",
    JSON.stringify(credentials, null, 2),
    { mode: 0o600 },
  );
  console.log(`Seeded 125 synthetic links: ${credentials.directoryEditor}`);
} finally {
  cache.disconnect();
  await client.close();
}
