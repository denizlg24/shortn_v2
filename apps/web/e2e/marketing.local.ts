/**
 * Marketing acceptance against a running sandbox (`bun scripts/marketing-dev.ts`)
 * or, with MARKETING_ORIGIN, against staging through the edge Worker. Read-only
 * except for demo links and one contact message on loopback.
 */
import { Redis } from "ioredis";
import { MongoClient } from "mongodb";

const origin = process.env.MARKETING_ORIGIN ?? "http://localhost:3400";
const loopback = new URL(origin).hostname === "localhost";
const locales = ["en", "pt", "es"] as const;
const pages = [
  "",
  "/features",
  "/pricing",
  "/about",
  "/contact",
  "/abuse",
  "/privacy",
  "/terms",
];
let failures = 0;
function check(condition: unknown, message: string) {
  if (condition) console.log(`ok   ${message}`);
  else {
    failures++;
    console.error(`FAIL ${message}`);
  }
}
const get = (path: string, init: RequestInit = {}) =>
  fetch(new URL(path, origin), { redirect: "manual", ...init });
const attribute = (html: string, pattern: RegExp) =>
  [...html.matchAll(pattern)].map((match) => match[1]);

for (const locale of locales)
  for (const page of pages) {
    const path = `/${locale}${page}`;
    const response = await get(path);
    const html = await response.text();
    const canonical = attribute(
      html,
      /<link rel="canonical" href="([^"]+)"/g,
    )[0];
    const alternates = Object.fromEntries(
      [
        ...html.matchAll(
          /<link rel="alternate" hrefLang="([^"]+)" href="([^"]+)"/g,
        ),
      ].map((match) => [match[1], match[2]]),
    );
    check(response.status === 200, `${path} is 200`);
    check(
      canonical?.endsWith(path),
      `${path} is self-canonical (${canonical})`,
    );
    check(
      locales.every((other) =>
        alternates[other]?.endsWith(`/${other}${page}`),
      ) && alternates["x-default"]?.endsWith(`/en${page}`),
      `${path} has reciprocal hreflang and x-default`,
    );
    check(
      /<html lang="(en|pt-PT|es)"/.test(html) &&
        html.includes(`lang="${locale === "pt" ? "pt-PT" : locale}"`),
      `${path} declares its language`,
    );
  }

const redirects: [string, number, string][] = [
  ["/en/products", 301, "/en/features"],
  ["/pt/products/qr-code", 301, "/pt/features#qr-codes"],
  ["/es/products/url-shortener?x=1", 301, "/es/features?x=1#links"],
  ["/en/help", 301, "/docs/en/guides"],
  [
    "/pt/help/articles/links/utm-parameters",
    301,
    "/docs/pt/guides/links/utm-parameters",
  ],
  ["/es/help/articles/billing/plans-pricing", 301, "/es/pricing"],
  ["/en/reset?token=abc", 301, "/reset?token=abc"],
  ["/pt/login", 301, "/login"],
  ["/en/auth/error?error=x", 301, "/login?error=x"],
  [
    "/en/verify/request-change?token=t&email=a&new=b",
    301,
    "/api/auth/verify-email?token=t&callbackURL=%2Fverify",
  ],
];
for (const [path, status, location] of redirects) {
  const response = await get(path);
  const target = response.headers.get("location") ?? "";
  check(
    response.status === status && target.endsWith(location),
    `${path} → ${status} ${location} (got ${response.status} ${target})`,
  );
}
const login = await get("/pt/login");
check(
  login.headers.get("set-cookie")?.includes("NEXT_LOCALE=pt"),
  "auth redirects carry the visitor language",
);
check((await get("/en/no-such-page")).status === 404, "unknown pages are 404");
check(
  (await get("/_marketing/en")).status === 404,
  "internal paths are hidden",
);
const root = await get("/", { headers: { "accept-language": "pt-PT,pt" } });
check(
  root.status === 302 && root.headers.get("location")?.endsWith("/pt"),
  `/ negotiates the locale (${root.status} ${root.headers.get("location")})`,
);

const sitemap = await (await get("/sitemap.xml")).text();
const listed = attribute(sitemap, /<loc>([^<]+)<\/loc>/g);
check(listed.length >= 24 + 3, `sitemap lists ${listed.length} URLs`);
for (const url of listed) {
  const response = await fetch(url.replace(/^https?:\/\/[^/]+/, origin), {
    redirect: "manual",
  });
  check(response.status === 200, `sitemap URL ${url} is 200`);
}
check(
  (await (await get("/robots.txt")).text()).includes("Sitemap:"),
  "robots.txt points at the sitemap",
);

if (loopback) {
  const post = (body: unknown, ip: string, headers: HeadersInit = {}) =>
    fetch(new URL("/en/demo", origin), {
      method: "POST",
      headers: {
        origin,
        "content-type": "application/json",
        "cf-connecting-ip": ip,
        ...headers,
      },
      body: JSON.stringify(body),
    });
  const error = async (response: Response) =>
    ((await response.json()) as { error?: string }).error;
  const token = "XXXX.DUMMY.TOKEN.XXXX";
  check(
    (
      await post({ url: "https://example.com", token }, "198.51.100.1", {
        origin: "https://evil.example",
      })
    ).status === 403,
    "demo refuses other origins",
  );
  check(
    (await error(await post({ url: "nope", token }, "198.51.100.1"))) ===
      "invalid",
    "demo refuses invalid addresses",
  );
  check(
    (await error(
      await post({ url: "https://example.com", token: "" }, "198.51.100.1"),
    )) === "challenge",
    "demo refuses a failed challenge",
  );
  check(
    (await error(
      await post(
        { url: "http://203.0.113.7/setup.exe", token },
        "198.51.100.1",
      ),
    )) === "blocked",
    "demo refuses unsafe destinations",
  );
  const made = await post(
    { url: "https://example.com/spring", token },
    "198.51.100.2",
  );
  const link = (await made.json()) as { shortUrl?: string; key?: string };
  check(made.ok && link.key, `demo creates ${link.shortUrl}`);
  const statuses: number[] = [];
  for (let attempt = 0; attempt < 6; attempt++)
    statuses.push(
      (await post({ url: "https://example.com/x", token }, "198.51.100.3"))
        .status,
    );
  check(
    statuses.slice(0, 5).every((status) => status === 200) &&
      statuses[5] === 429,
    `demo limits one visitor (${statuses.join(",")})`,
  );
  const redis = new Redis("redis://127.0.0.1:16380/7");
  await redis.set(`demo:created:${new Date().toISOString().slice(0, 10)}`, 1e6);
  check(
    (await error(
      await post({ url: "https://example.com/y", token }, "198.51.100.4"),
    )) === "capReached",
    "demo stops at the daily cap",
  );
  await redis.del(`demo:created:${new Date().toISOString().slice(0, 10)}`);
  redis.disconnect();

  const mongo = await new MongoClient(
    "mongodb://127.0.0.1:27020/?directConnection=true",
  ).connect();
  const stored = await mongo
    .db("shortn_marketing_dev")
    .collection("urlv3")
    .findOne({ key: link.key });
  check(
    stored?.demo === true &&
      !stored.workspaceId &&
      stored.rules?.expiresAt instanceof Date,
    "demo link is workspace-less and expires",
  );
  const contact = await fetch(new URL("/pt/contact/send", origin), {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      "cf-connecting-ip": "198.51.100.9",
    },
    body: JSON.stringify({
      name: "Ana Teste",
      email: "ana@shortn.invalid",
      topic: "billing",
      message: "Preciso de uma fatura com o NIF da empresa.",
      token,
    }),
  });
  const reference = ((await contact.json()) as { reference?: string })
    .reference;
  const row = await mongo
    .db("shortn_marketing_dev")
    .collection("contacts")
    .findOne({ ticketId: reference });
  check(
    contact.ok &&
      row?.subject === "Billing and invoices" &&
      /^[a-f0-9]{64}$/.test(String(row.ipAddress)),
    `contact stores ${reference} in the legacy shape with a hashed address`,
  );
  await mongo.close();
}

if (failures) {
  console.error(`${failures} check(s) failed`);
  process.exit(1);
}
console.log("All marketing checks passed");
