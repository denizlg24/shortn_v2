import createClient from "openapi-fetch";
import type { paths } from "./schema";
export type { paths, components } from "./schema";

export function createShortnClient(options: {
  apiKey: string;
  baseUrl?: string;
  fetch?: (request: Request) => Promise<Response>;
}) {
  return createClient<paths>({
    baseUrl: options.baseUrl ?? "https://api.shortn.at",
    headers: { Authorization: `Bearer ${options.apiKey}` },
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
}
