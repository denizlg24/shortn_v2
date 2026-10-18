import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import type { Db, ObjectId } from "mongodb";
import {
  linkMetadataJobs,
  metadataActorAllowed,
  ensureLinkMetadataIndexes,
} from "@shortn/core";
import { resolveHealthTarget } from "./health-probe";
import { pinnedLookup } from "./webhook-sender";

const maxHtmlBytes = 262144;
function cleanTitle(value: string) {
  const entities: Record<string, string> = {
    amp: "&",
    quot: '"',
    apos: "'",
    lt: "<",
    gt: ">",
    nbsp: " ",
  };
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(
      /&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi,
      (whole, code: string) => {
        if (code[0] !== "#") return entities[code.toLowerCase()] ?? whole;
        const number =
          code[1]?.toLowerCase() === "x"
            ? parseInt(code.slice(2), 16)
            : Number(code.slice(1));
        return number > 0 &&
          number <= 0x10ffff &&
          !(number >= 0xd800 && number <= 0xdfff)
          ? String.fromCodePoint(number)
          : "";
      },
    )
    .split("")
    .map((char) =>
      char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 ? " " : char,
    )
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200)
    .replace(/[\ud800-\udbff]$/, "");
}
export function titleFromHtml(input: string) {
  const html = input
    .slice(0, maxHtmlBytes)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  for (const match of html.matchAll(/<meta\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi)) {
    const attributes = new Map<string, string>();
    for (const attr of match[0]
      .slice(5, -1)
      .matchAll(
        /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g,
      )) {
      const key = attr[1]!.toLowerCase();
      if (!attributes.has(key))
        attributes.set(key, attr[2] ?? attr[3] ?? attr[4] ?? "");
    }
    if (
      (attributes.get("property") ?? attributes.get("name"))?.toLowerCase() ===
      "og:title"
    ) {
      const title = cleanTitle(attributes.get("content") ?? "");
      if (title) return title;
    }
  }
  const title = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(html)?.[1];
  return title ? cleanTitle(title) || null : null;
}
type FetchDependencies = {
  resolve?: Parameters<typeof resolveHealthTarget>[1];
  request?: typeof httpRequest;
  timeoutMs?: number;
};
async function readHtml(
  value: string,
  deadline: number,
  deps: FetchDependencies,
) {
  const target = await resolveHealthTarget(value, deps.resolve);
  if (Date.now() >= deadline) throw new Error("metadata_timeout");
  return await new Promise<{
    status: number;
    location?: string;
    html?: string;
  }>((resolve, reject) => {
    let settled = false;
    const request =
      deps.request ??
      (target.url.protocol === "https:" ? httpsRequest : httpRequest);
    const req = request(
      target.url,
      {
        method: "GET",
        agent: false,
        family: target.address.family,
        maxHeaderSize: 16384,
        lookup: pinnedLookup(target.address),
        headers: {
          "User-Agent": "Shortn-LinkMetadata/1.0",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Encoding": "identity",
          Range: `bytes=0-${maxHtmlBytes - 1}`,
        },
      },
      (response) => {
        const status = response.statusCode ?? 0;
        if ([301, 302, 303, 307, 308].includes(status)) {
          finish({
            status,
            ...(response.headers.location
              ? { location: response.headers.location }
              : {}),
          });
          response.destroy();
          return;
        }
        const contentType = response.headers["content-type"] ?? "";
        if (
          status < 200 ||
          status >= 300 ||
          !/^(text\/html|application\/xhtml\+xml)(?:;|$)/i.test(contentType) ||
          (response.headers["content-encoding"] &&
            response.headers["content-encoding"] !== "identity")
        ) {
          finish({ status });
          response.destroy();
          return;
        }
        const chunks: Buffer[] = [];
        let bytes = 0;
        const complete = () => {
          const charset =
            /charset\s*=\s*["']?([^\s;"']+)/i.exec(contentType)?.[1] ?? "utf-8";
          let html: string;
          try {
            html = new TextDecoder(charset).decode(Buffer.concat(chunks));
          } catch {
            html = Buffer.concat(chunks).toString("utf8");
          }
          finish({ status, html });
        };
        response.on("data", (chunk: Buffer) => {
          if (settled) return;
          const part = Buffer.from(chunk).subarray(0, maxHtmlBytes - bytes);
          chunks.push(part);
          bytes += part.length;
          if (bytes >= maxHtmlBytes) {
            complete();
            response.destroy();
          }
        });
        response.once("end", complete);
        response.once("error", fail);
        response.once("aborted", () => {
          if (!settled) fail(new Error("metadata_aborted"));
        });
      },
    );
    const timer = setTimeout(
      () => {
        fail(new Error("metadata_timeout"));
        req.destroy();
      },
      Math.max(1, deadline - Date.now()),
    );
    function finish(result: {
      status: number;
      location?: string;
      html?: string;
    }) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    }
    function fail(error: Error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    }
    req.once("error", fail);
    req.end();
  });
}
export async function fetchLinkTitle(
  value: string,
  deps: FetchDependencies = {},
) {
  const deadline = Date.now() + (deps.timeoutMs ?? 8000);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        let url = value;
        for (let hop = 0; hop <= 3; hop++) {
          const result = await readHtml(url, deadline, deps);
          if (
            result.location &&
            [301, 302, 303, 307, 308].includes(result.status)
          ) {
            if (hop === 3) return null;
            url = new URL(result.location, url).href;
            continue;
          }
          return result.html ? titleFromHtml(result.html) : null;
        }
        return null;
      })(),
      new Promise<null>((resolve) => {
        timer = setTimeout(
          () => resolve(null),
          Math.max(1, deadline - Date.now()),
        );
      }),
    ]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
/** Durable lease plus conditional finish prevents stale workers from publishing results. */
export async function runLinkMetadataBatch(
  db: Db,
  fetchTitle: (url: string) => Promise<string | null> = fetchLinkTitle,
  now = new Date(),
  workspaceId?: ObjectId,
) {
  const run = async () => {
    const token = crypto.randomUUID();
    const job = await linkMetadataJobs(db).findOneAndUpdate(
      {
        ...(workspaceId ? { workspaceId } : {}),
        expiresAt: { $gt: now },
        $or: [
          { state: "pending" },
          { state: "running", leaseUntil: { $lte: now } },
        ],
      },
      {
        $set: {
          state: "running",
          leaseToken: token,
          leaseUntil: new Date(now.getTime() + 30_000),
        },
      },
      { sort: { createdAt: 1, _id: 1 }, returnDocument: "after" },
    );
    if (!job) return false;
    let title: string | null = null;
    if (await metadataActorAllowed(db, job.workspaceId, job.actorUserId)) {
      try {
        title = await fetchTitle(job.url);
      } catch {
        /* Optional enrichment never blocks creation. */
      }
    }
    const allowed = await metadataActorAllowed(
      db,
      job.workspaceId,
      job.actorUserId,
    );
    title = allowed && title ? cleanTitle(title) || null : null;
    await linkMetadataJobs(db).updateOne(
      {
        _id: job._id,
        state: "running",
        leaseToken: token,
        expiresAt: { $gt: new Date() },
      },
      {
        $set: {
          state: title ? "ready" : "unavailable",
          ...(title ? { title } : {}),
        },
        $unset: { leaseUntil: "", leaseToken: "" },
      },
    );
    return true;
  };
  const results = await Promise.allSettled([run(), run()]);
  const failed = results.find((result) => result.status === "rejected");
  if (failed?.status === "rejected") throw failed.reason;
  return results.map((result) => result.status === "fulfilled" && result.value);
}
export async function createLinkMetadataWorker(db: Db) {
  await ensureLinkMetadataIndexes(db);
  let pumping: Promise<unknown> | undefined,
    closing = false;
  return {
    pump() {
      if (closing) return Promise.resolve();
      return (pumping ??= runLinkMetadataBatch(db).finally(() => {
        pumping = undefined;
      }));
    },
    async close() {
      closing = true;
      await pumping;
    },
  };
}
