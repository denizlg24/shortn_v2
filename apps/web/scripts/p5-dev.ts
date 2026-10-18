/** Persistent, loopback-only P5 sandbox. Never points at staging/production data. */
import { readFile, writeFile } from "node:fs/promises";
import { parseEnv as parseDotenv } from "node:util";
import { fileURLToPath } from "node:url";
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { MongoClient, ObjectId } from "mongodb";
import { Redis } from "ioredis";
import { hashPassword } from "better-auth/crypto";
import { legacyCollectionKeys, physicalNames, syncIndexes } from "@shortn/db";
import {
  createBioPage,
  createLink,
  ensurePersonalWorkspace,
  publishBioDraft,
  readBioDraft,
  saveBioDraft,
  type ServiceContext,
} from "@shortn/core";
import { bioPresets } from "@shortn/core/bio-content";
import { devConfig } from "../../../scripts/dev-config";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const source = parseDotenv(await readFile(`${root}.env.staging`, "utf8"));
const web = "http://localhost:3100";
const { shared, ports } = devConfig(
  {
    ...source,
    MONGODB_URL: "mongodb://127.0.0.1:27020/?replicaSet=rs0",
    MONGODB_DB: "shortn_p5_dev",
    REDIS_CACHE_URL: "redis://127.0.0.1:16380/5",
    REDIS_DURABLE_URL: "redis://127.0.0.1:16379/5",
    S3_ENDPOINT: "http://127.0.0.1:19000",
    S3_REGION: "us-east-1",
    S3_BUCKET: "shortn-dev",
    S3_ACCESS_KEY_ID: "shortn-local",
    S3_SECRET_ACCESS_KEY: "shortn-local-development-secret",
    LINK_DOMAIN: "localhost:3102",
    EDGE_AUTH_SECRET: "",
    BIO_DELIVERY_ENABLED: "1",
    BIO_SUBDOMAINS: "0",
    BIO_LEGACY_REDIRECTS: "0",
    BIO_API_ORIGIN: "http://localhost:3103",
    BIO_WEB_ORIGIN: web,
    BIO_INTERNAL_SECRET: randomBytes(32).toString("hex"),
    DOMAIN_WRITES: "0",
    BILLING_WRITES: "0",
    RUN_CONTINUOUS_MIGRATIONS: "0",
    MAIL_ALLOWLIST: "nobody@shortn.invalid",
    CLOUDFLARE_API_TOKEN: "",
    CLOUDFLARE_ZONE_ID: "",
    POLAR_DOMAIN_PRODUCT_ID: "",
  },
  {
    DEV_WEB_PORT: "3100",
    DEV_REDIRECT_PORT: "3102",
    DEV_API_PORT: "3103",
    DEV_WORKER_PORT: "3104",
  },
);
const client = await new MongoClient(shared.MONGODB_URL!).connect();
const db = client.db(shared.MONGODB_DB),
  cache = new Redis(shared.REDIS_CACHE_URL!);
const email = "p5@example.test",
  password = `Shortn-P5-${randomBytes(6).toString("hex")}!`,
  now = new Date();
let credentials: {
  email: string;
  password: string;
  dashboard: string;
  editor: string;
  bio: string;
};
try {
  const existing = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map(
      (c) => c.name,
    ),
  );
  for (const key of legacyCollectionKeys)
    if (!existing.has(physicalNames[key]))
      await db.createCollection(physicalNames[key]);
  await syncIndexes(db);
  const user = await db.collection(physicalNames.user).findOne({ email });
  const userId = user?._id ?? new ObjectId();
  await db
    .collection(physicalNames.user)
    .updateOne(
      { _id: userId },
      {
        $set: {
          name: "P5 Studio",
          username: "p5studio",
          displayUsername: "p5studio",
          email,
          emailVerified: true,
          locale: "en",
          sub: "p5|local-demo",
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now, image: null },
      },
      { upsert: true },
    );
  await db
    .collection(physicalNames.account)
    .updateOne(
      { userId, providerId: "credential" },
      {
        $set: {
          accountId: String(userId),
          password: await hashPassword(password),
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
  const workspace = await ensurePersonalWorkspace(db, {
    id: String(userId),
    email,
    name: "P5 Studio",
    username: "p5studio",
    sub: "p5|local-demo",
  });
  await db
    .collection(physicalNames.subscriptions)
    .updateOne(
      { polarSubscriptionId: "p5-local-pro" },
      {
        $set: {
          workspaceId: workspace._id,
          plan: "pro",
          status: "active",
          currentPeriodStart: now,
          currentPeriodEnd: new Date(now.getTime() + 365 * 86400000),
          productId: "local-fixture",
          polarCustomerId: "local-fixture",
        },
      },
      { upsert: true },
    );
  const ctx: ServiceContext = {
    db,
    cache,
    workspace,
    actor: { userId: String(userId), role: "owner" },
    linkDomain: shared.LINK_DOMAIN!,
  };
  const destinations = [
    [
      "p5-portfolio",
      "Portfolio & selected work",
      "https://example.com/portfolio",
    ],
    [
      "p5-newsletter",
      "Letters from the studio",
      "https://example.com/newsletter",
    ],
    ["p5-music", "São João — música e encontros", "https://example.com/music"],
    ["p5-contact", "Say hello", "https://example.com/contact"],
  ];
  const linkIds: string[] = [];
  for (const [key, title, url] of destinations) {
    let link = await db
      .collection(physicalNames.links)
      .findOne({ workspaceId: workspace._id, key });
    if (!link) {
      const result = await createLink(ctx, {
        key: key!,
        title: title!,
        url: url!,
      });
      if (!result.ok) throw new Error(result.error);
      link = await db
        .collection(physicalNames.links)
        .findOne({ _id: new ObjectId(result.value.id) });
    }
    if (!link) throw new Error("Seed link missing");
    linkIds.push(String(link._id));
    await db
      .collection(physicalNames.links)
      .updateOne(
        { _id: link._id },
        {
          $set: {
            safetyStatus: "safe",
            requiresInterstitial: false,
            "safety.status": "safe",
            "safety.interstitial": false,
          },
        },
      );
  }
  let page = await db
    .collection(physicalNames.bio_pages)
    .findOne({ workspaceId: workspace._id, handle: "p5-studio" });
  if (!page) {
    const created = await createBioPage(ctx, {
      slug: "p5-studio",
      title: "P5 Studio",
    });
    if (!created.ok) throw new Error(created.error);
    const draft = (await readBioDraft(ctx, created.value.id))!;
    const saved = await saveBioDraft(ctx, created.value.id, draft.revision, {
      ...draft.content,
      theme: bioPresets.forest,
      seo: {
        title: "P5 Studio",
        description: "A local P5 demonstration",
        noindex: true,
      },
      blocks: [
        {
          id: "profile",
          visible: true,
          type: "profile",
          title: "P5 Studio",
          description:
            "A small studio making thoughtful things.\nDesign, music & stories — histórias e encontros.",
          avatar: "",
          align: "left",
          avatarShape: "circle",
          paidBadge: true,
        },
        {
          id: "intro",
          visible: true,
          type: "text",
          text: "Welcome to your **P5 sandbox**. Edit the blocks, try a theme, then publish to see the public page change.",
        },
        {
          id: "work",
          visible: true,
          type: "header",
          text: "Around the studio",
        },
        ...linkIds.map((linkId, at) => ({
          id: `link-${at}`,
          visible: true,
          type: "link",
          linkId,
          title: destinations[at]![1],
          image: "",
          highlight: at === 0,
        })),
        {
          id: "social",
          visible: true,
          type: "socials",
          items: [
            { platform: "github", url: "https://github.com" },
            { platform: "instagram", url: "https://instagram.com" },
          ],
        },
        {
          id: "music",
          visible: true,
          type: "embed",
          provider: "youtube",
          url: "https://youtu.be/dQw4w9WgXcQ",
        },
        {
          id: "qr",
          visible: true,
          type: "qr",
          linkId: linkIds[0],
          title: "Take the studio with you",
        },
      ],
    });
    if (!saved.ok) throw new Error(saved.error);
    const published = await publishBioDraft(
      ctx,
      created.value.id,
      saved.value.revision,
    );
    if (!published.ok) throw new Error(published.error);
    page = await db
      .collection(physicalNames.bio_pages)
      .findOne({ _id: new ObjectId(created.value.id) });
  }
  credentials = {
    email,
    password,
    dashboard: `${web}/${workspace.slug}/links`,
    editor: `${web}/${workspace.slug}/bio/${page!._id}/editor`,
    bio: `${web}/_bio/p5-studio`,
  };
  await writeFile(
    "/tmp/shortn-p5-login.json",
    JSON.stringify(credentials, null, 2),
    { mode: 0o600 },
  );
} finally {
  cache.disconnect();
  await client.close();
}
await import("./seed-p5-directory");
const children: ChildProcess[] = [];
for (const name of ["web", "redirect", "api", "worker"] as const) {
  const child = spawn(
    name === "web" ? "node" : process.execPath,
    name === "web"
      ? [
          "node_modules/next/dist/bin/next",
          "dev",
          "--hostname",
          "127.0.0.1",
          "--port",
          String(ports.web),
        ]
      : ["--no-env-file", "--watch", "src/index.ts"],
    {
      cwd: `${root}apps/${name}`,
      env: {
        ...process.env,
        ...shared,
        ...(name === "worker" ? { POLAR_ACCESS_TOKEN: "" } : {}),
        PORT: String(ports[name]),
      },
      stdio: "inherit",
      detached: true,
    },
  );
  children.push(child);
}
console.log(
  `P5 local sandbox running. Login: ${web}/login; credentials: /tmp/shortn-p5-login.json`,
);
function stop() {
  for (const child of children) {
    try {
      process.kill(-child.pid!, "SIGTERM");
    } catch {
      /* Already stopped. */
    }
  }
  process.exit(0);
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
