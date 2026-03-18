import { MeiliSearch } from "meilisearch";
import env from "@/utils/env";

export const MEILI_INDEX_LINKS = env.MEILI_INDEX_LINKS ?? "links";
export const MEILI_INDEX_QR_CODES = env.MEILI_INDEX_QR_CODES ?? "qrcodes";

let client: MeiliSearch | null = null;

function getMeiliClient(): MeiliSearch | null {
  if (!env.MEILI_URL) return null;
  if (!client) {
    client = new MeiliSearch({
      host: env.MEILI_URL,
      apiKey: env.MEILI_MASTER_KEY,
    });
  }
  return client;
}

export interface MeiliSearchResult {
  ids: string[];
  total: number;
}

export async function searchMeili(
  index: string,
  query: string,
  sub: string | undefined,
  limit: number = 1000,
): Promise<MeiliSearchResult> {
  const meili = getMeiliClient();
  if (!meili) {
    return { ids: [], total: 0 };
  }

  const result = await meili.index(index).search(query, {
    filter: `sub = "${sub}"`,
    limit,
    attributesToRetrieve: ["id"],
  });

  return {
    ids: result.hits.map((hit) => hit.id as string),
    total: result.estimatedTotalHits ?? result.hits.length,
  };
}

export default getMeiliClient;
