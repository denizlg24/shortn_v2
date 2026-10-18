import { lookup } from "node:dns/promises";
import { request } from "node:https";
import type { RequestOptions } from "node:http";
import ipaddr from "ipaddr.js";

export class WebhookSendError extends Error {
  constructor(
    public code: "destination_rejected" | "timeout" | "network_error",
  ) {
    super(code);
  }
}
export function publicWebhookAddress(address: string): boolean {
  try {
    return (
      !address.includes("%") && ipaddr.parse(address).range() === "unicast"
    );
  } catch {
    return false;
  }
}
// Bun requests all-address lookup results even when a family was supplied.
// Return only the vetted address in either callback form, preserving the pin.
export function pinnedLookup(address: {
  address: string;
  family: number;
}): NonNullable<RequestOptions["lookup"]> {
  return (_host, options, callback) => {
    if (options.all)
      (
        callback as unknown as (
          error: NodeJS.ErrnoException | null,
          addresses: { address: string; family: number }[],
        ) => void
      )(null, [address]);
    else callback(null, address.address, address.family);
  };
}
export async function resolveWebhookTarget(
  value: string,
  resolve = (hostname: string) => lookup(hostname, { all: true }),
) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.hash)
    throw new WebhookSendError("destination_rejected");
  const addresses = await resolve(url.hostname.replace(/^\[|\]$/g, ""));
  if (
    !addresses.length ||
    addresses.some((address) => !publicWebhookAddress(address.address))
  )
    throw new WebhookSendError("destination_rejected");
  return { url, address: addresses[0]! };
}
export async function sendWebhook(
  value: string,
  body: string,
  headers: Record<string, string>,
): Promise<number> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const target = await Promise.race([
      resolveWebhookTarget(value),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new WebhookSendError("timeout")),
          10000,
        );
      }),
    ]);
    if (timer) clearTimeout(timer);
    return await new Promise<number>((resolve, reject) => {
      const req = request(
        target.url,
        {
          method: "POST",
          headers: { ...headers, "Content-Length": Buffer.byteLength(body) },
          agent: false,
          family: target.address.family,
          lookup: pinnedLookup(target.address),
        },
        (response) => {
          const status = response.statusCode ?? 0;
          response.destroy();
          resolve(status);
        },
      );
      timer = setTimeout(() => {
        reject(new WebhookSendError("timeout"));
        req.destroy();
      }, 10000);
      req.on("error", (error) =>
        reject(
          error instanceof WebhookSendError
            ? error
            : new WebhookSendError("network_error"),
        ),
      );
      req.end(body);
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}
