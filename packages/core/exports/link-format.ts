import type { LinkView } from "../links/service";
import { csvCell } from "../imports/csv";

export type LinkExportFormat = "csv" | "json";
export interface ExportedLink {
  url: string;
  key: string;
  title: string;
  tags: string[];
  domain: string;
  expires_at: string;
  created_at: string;
  clicks: number;
}
export const linkCsvVersion = "shortn-csv-v1";
export const linkCsvColumns = [
  "shortn_format",
  "url",
  "key",
  "title",
  "tags",
  "domain",
  "expires_at",
  "created_at",
  "clicks",
] as const;
export function exportedLink(link: LinkView): ExportedLink {
  return {
    url: link.url,
    key: link.key,
    title: link.title,
    tags: link.tags.map((tag) => tag.name),
    domain: link.domain,
    expires_at: link.rules?.expiresAt ?? "",
    created_at: link.createdAt,
    clicks: link.clicks,
  };
}
/** Escape formula prefixes and literal apostrophes reversibly for our versioned CSV. */
function safeCell(value: string) {
  return csvCell(
    /^(?:'|\s*[=+\-@]|[\t\r\n])/.test(value) ? `'${value}` : value,
    false,
  );
}
export function linkCsvRecord(link: ExportedLink): string {
  return (
    [
      linkCsvVersion,
      link.url,
      link.key,
      link.title,
      JSON.stringify(link.tags),
      link.domain,
      link.expires_at,
      link.created_at,
      String(link.clicks),
    ]
      .map(safeCell)
      .join(",") + "\r\n"
  );
}
/** Caller owns the bounded Mongo cursor; this encoder never accumulates the library. */
export async function* encodeLinkExport(
  rows: AsyncIterable<ExportedLink>,
  format: LinkExportFormat,
): AsyncGenerator<Uint8Array> {
  if (format !== "csv" && format !== "json") throw new Error("invalid_export");
  const encoder = new TextEncoder();
  yield encoder.encode(
    format === "csv" ? linkCsvColumns.join(",") + "\r\n" : "[\n",
  );
  let first = true;
  for await (const row of rows) {
    yield encoder.encode(
      format === "csv"
        ? linkCsvRecord(row)
        : `${first ? "" : ",\n"}${JSON.stringify(row)}`,
    );
    first = false;
  }
  if (format === "json") yield encoder.encode("\n]\n");
}
