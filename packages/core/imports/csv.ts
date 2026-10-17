import { z } from "zod";
import type { CreateLinkInput } from "../links/service";

export const importLimits = {
  bytes: 10 * 1024 * 1024,
  rows: 50_000,
  columns: 64,
  field: 8192,
  preview: 20,
  chunk: 500,
} as const;
export type ImportField =
  | "url"
  | "key"
  | "title"
  | "tags"
  | "utm_source"
  | "utm_medium"
  | "utm_campaign"
  | "utm_term"
  | "utm_content"
  | "expires_at"
  | "domain";
export type ImportMapping = Partial<Record<ImportField, number>>;
export interface ImportRecord {
  row: number;
  cells: string[];
}
export interface ImportTable {
  columns: string[];
  records: ImportRecord[];
}
export class ImportInputError extends Error {
  constructor(
    readonly code:
      | "file_too_large"
      | "too_many_rows"
      | "too_many_columns"
      | "field_too_large"
      | "invalid_csv"
      | "invalid_encoding"
      | "invalid_mapping",
    readonly row?: number,
  ) {
    super(code);
  }
}

/** Worker-side bounded parser. Only the first 20 rows belong in a browser preview. */
export function parseImportCsv(bytes: Uint8Array): ImportTable {
  if (bytes.byteLength > importLimits.bytes)
    throw new ImportInputError("file_too_large");
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ImportInputError("invalid_encoding");
  }
  if (text.includes("\0")) throw new ImportInputError("invalid_csv");
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    closed = false;
  const addField = () => {
    if (row.length >= importLimits.columns)
      throw new ImportInputError("too_many_columns", rows.length);
    row.push(field);
    field = "";
    closed = false;
  };
  const addRow = () => {
    addField();
    rows.push(row);
    row = [];
    if (rows.length > importLimits.rows + 1)
      throw new ImportInputError("too_many_rows");
  };
  for (let index = 0; index < text.length; index++) {
    const char = text[index]!;
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += char;
    } else if (char === ",") addField();
    else if (char === "\n" || char === "\r") {
      addRow();
      if (char === "\r" && text[index + 1] === "\n") index++;
    } else if (char === '"' && !field && !closed) quoted = true;
    else {
      if (char === '"' || closed)
        throw new ImportInputError("invalid_csv", rows.length);
      field += char;
    }
    if (field.length > importLimits.field)
      throw new ImportInputError("field_too_large", rows.length);
  }
  if (quoted) throw new ImportInputError("invalid_csv", rows.length);
  if (field || row.length || closed) addRow();
  const columns = rows.shift()?.map((value) => value.trim()) ?? [];
  if (!columns.length || columns.some((name) => !name || name.length > 128))
    throw new ImportInputError("invalid_csv", 0);
  return {
    columns,
    records: rows.map((cells, index) => ({ row: index + 1, cells })),
  };
}

const aliases: Record<ImportField, readonly string[]> = {
  url: ["url", "destination", "long_url"],
  key: ["key", "slug", "code"],
  title: ["title"],
  tags: ["tags"],
  utm_source: ["utm_source"],
  utm_medium: ["utm_medium"],
  utm_campaign: ["utm_campaign"],
  utm_term: ["utm_term"],
  utm_content: ["utm_content"],
  expires_at: ["expires_at"],
  domain: ["domain"],
};
export function detectImportMapping(columns: string[]): ImportMapping {
  const normalized = columns.map((name) =>
    name.trim().toLowerCase().replace(/[ -]+/g, "_"),
  );
  const mapping: ImportMapping = {};
  for (const [field, names] of Object.entries(aliases)) {
    const matches = normalized.flatMap((name, index) =>
      names.includes(name) ? [index] : [],
    );
    if (matches.length === 1) mapping[field as ImportField] = matches[0]!;
  }
  return mapping;
}
export function validateImportMapping(
  columns: string[],
  mapping: ImportMapping,
): boolean {
  if (!Number.isInteger(mapping.url)) return false;
  const selected = Object.values(mapping);
  return (
    new Set(selected).size === selected.length &&
    Object.entries(mapping).every(
      ([field, index]) =>
        Object.hasOwn(aliases, field) &&
        Number.isInteger(index) &&
        index! >= 0 &&
        index! < columns.length,
    )
  );
}

/** Pure mapping; live core validation runs in the worker dry run and again on commit. */
export function mapImportRecord(
  table: Pick<ImportTable, "columns">,
  mapping: ImportMapping,
  record: ImportRecord,
):
  | { ok: true; input: CreateLinkInput }
  | {
      ok: false;
      error:
        | "invalid_mapping"
        | "column_count"
        | "missing_url"
        | "invalid_date"
        | "invalid_tags";
    } {
  if (!validateImportMapping(table.columns, mapping))
    return { ok: false, error: "invalid_mapping" };
  if (record.cells.length !== table.columns.length)
    return { ok: false, error: "column_count" };
  const formatColumns = table.columns.flatMap((column, index) =>
    column.trim().toLowerCase() === "shortn_format" ? [index] : [],
  );
  const version =
    formatColumns.length === 1 ? record.cells[formatColumns[0]!]!.trim() : "";
  if (
    formatColumns.length > 1 ||
    (formatColumns.length === 1 && version !== "shortn-csv-v1")
  )
    return { ok: false, error: "invalid_mapping" };
  const ownFormat = version === "shortn-csv-v1";
  const value = (field: ImportField) => {
    const raw =
      mapping[field] === undefined ? "" : record.cells[mapping[field]!]!.trim();
    return ownFormat && raw.startsWith("'") ? raw.slice(1) : raw;
  };
  let url = value("url");
  if (!url) return { ok: false, error: "missing_url" };
  const utm = (Object.keys(aliases) as ImportField[]).filter(
    (field) => field.startsWith("utm_") && value(field),
  );
  if (utm.length) {
    try {
      const target = new URL(
        /^[a-z][a-z\d+.-]*:/i.test(url) ? url : `https://${url}`,
      );
      for (const field of utm) target.searchParams.set(field, value(field));
      url = target.toString();
    } catch {
      /* Core returns the same invalid URL error for imports and ordinary creation. */
    }
  }
  let tags: string[];
  if (ownFormat) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value("tags") || "[]");
    } catch {
      return { ok: false, error: "invalid_tags" };
    }
    if (!Array.isArray(parsed) || parsed.some((tag) => typeof tag !== "string"))
      return { ok: false, error: "invalid_tags" };
    tags = parsed;
  } else
    tags = value("tags")
      .split(/[;,]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  if (tags.length > 50 || tags.some((tag) => tag.length > 64))
    return { ok: false, error: "invalid_tags" };
  const expiry = value("expires_at");
  if (
    expiry &&
    (!z.iso.datetime({ offset: true }).safeParse(expiry).success ||
      !Number.isFinite(Date.parse(expiry)))
  )
    return { ok: false, error: "invalid_date" };
  return {
    ok: true,
    input: {
      url,
      ...(value("key") ? { key: value("key") } : {}),
      ...(value("title") ? { title: value("title") } : {}),
      ...(value("domain") ? { domain: value("domain").toLowerCase() } : {}),
      ...(tags.length ? { tags: [...new Set(tags)] } : {}),
      ...(expiry
        ? { rules: { expiresAt: new Date(expiry).toISOString() } }
        : {}),
    },
  };
}

/** URL paste becomes the same immutable CSV input, not a second creation path. */
export function pastedImportCsv(text: string): Uint8Array {
  if (new TextEncoder().encode(text).byteLength > importLimits.bytes)
    throw new ImportInputError("file_too_large");
  const urls = text
    .split(/\r\n|\r|\n/)
    .map((url) => url.trim())
    .filter(Boolean);
  if (urls.length > importLimits.rows)
    throw new ImportInputError("too_many_rows");
  const bytes = new TextEncoder().encode(
    ["url", ...urls.map((url) => csvCell(url, false))].join("\r\n"),
  );
  if (bytes.byteLength > importLimits.bytes)
    throw new ImportInputError("file_too_large");
  return bytes;
}
export function csvCell(value: string, spreadsheetSafe = true): string {
  const safe =
    spreadsheetSafe && /^(?:\s*[=+\-@]|[\t\r\n])/.test(value)
      ? `'${value}`
      : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
