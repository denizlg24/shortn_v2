import { expect, test } from "bun:test";
import {
  parseImportCsv,
  detectImportMapping,
  mapImportRecord,
  pastedImportCsv,
  csvCell,
  importLimits,
  validateImportMapping,
} from "./csv";
const bytes = (value: string) => new TextEncoder().encode(value);
test("CSV preserves quoted commas, escaped quotes, multiline fields, BOM, CRLF and stable row numbers", () => {
  const table = parseImportCsv(
    bytes(
      '\ufeffURL,Title,tags\r\nhttps://example.com,"São João, ""edição""\nsemanal","News;Team"\r\nhttps://example.org,Other,\r\n',
    ),
  );
  expect(table.columns).toEqual(["URL", "Title", "tags"]);
  expect(table.records).toEqual([
    {
      row: 1,
      cells: [
        "https://example.com",
        'São João, "edição"\nsemanal',
        "News;Team",
      ],
    },
    { row: 2, cells: ["https://example.org", "Other", ""] },
  ]);
});
test("every supported column is detected without ambiguous or duplicate field assignments", () => {
  const columns = [
    "Destination",
    "Slug",
    "Title",
    "Tags",
    "UTM source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "Expires At",
    "Domain",
  ];
  const mapping = detectImportMapping(columns);
  expect(mapping).toEqual({
    url: 0,
    key: 1,
    title: 2,
    tags: 3,
    utm_source: 4,
    utm_medium: 5,
    utm_campaign: 6,
    utm_term: 7,
    utm_content: 8,
    expires_at: 9,
    domain: 10,
  });
  expect(validateImportMapping(columns, mapping)).toBe(true);
  expect(detectImportMapping(["url", "destination"])).toEqual({});
  expect(validateImportMapping(columns, { url: 0, title: 0 })).toBe(false);
  expect(validateImportMapping(columns, { url: 99 })).toBe(false);
  expect(validateImportMapping(columns, { url: -1 })).toBe(false);
});
test("mapping preserves key, domain, title, tags, expiry and destination query/fragment while adding UTM", () => {
  const table = parseImportCsv(
    bytes(
      'long_url,key,title,tags,utm_source,expires_at,domain\n"example.com/a?existing=1&utm_source=old#section",news,Newsletter,"Team;News;Team",email,2027-01-01T12:00:00Z,GO.EXAMPLE.COM',
    ),
  );
  expect(
    mapImportRecord(
      table,
      detectImportMapping(table.columns),
      table.records[0]!,
    ),
  ).toEqual({
    ok: true,
    input: {
      url: "https://example.com/a?existing=1&utm_source=email#section",
      key: "news",
      title: "Newsletter",
      tags: ["Team", "News"],
      rules: { expiresAt: "2027-01-01T12:00:00.000Z" },
      domain: "go.example.com",
    },
  });
});
test("row errors distinguish width, missing URL, malformed expiry and oversized tags", () => {
  const table = { columns: ["url", "expires_at", "tags"] },
    mapping = detectImportMapping(table.columns);
  for (const [cells, error] of [
    [["url"], "column_count"],
    [["", "", ""], "missing_url"],
    [["https://example.com", "yesterday", ""], "invalid_date"],
    [["https://example.com", "2027-02-30T12:00:00Z", ""], "invalid_date"],
    [["https://example.com", "", "x".repeat(65)], "invalid_tags"],
  ] as const)
    expect(
      mapImportRecord(table, mapping, { row: 1, cells: [...cells] }),
    ).toEqual({ ok: false, error });
});
test("strict syntax, UTF8, NUL, field, column, byte and 50k row limits are enforced", () => {
  for (const value of [
    'url\n"unterminated',
    'url\n"closed"junk',
    'url\nunquoted"quote',
    "url\na\0b",
    ",title\na,b",
  ])
    expect(() => parseImportCsv(bytes(value))).toThrow("invalid_csv");
  expect(() => parseImportCsv(new Uint8Array([0xff]))).toThrow(
    "invalid_encoding",
  );
  expect(() =>
    parseImportCsv(bytes("url\n" + "x".repeat(importLimits.field + 1))),
  ).toThrow("field_too_large");
  expect(() =>
    parseImportCsv(
      bytes(Array.from({ length: 65 }, (_, i) => `col${i}`).join(",")),
    ),
  ).toThrow("too_many_columns");
  expect(() => parseImportCsv(new Uint8Array(importLimits.bytes + 1))).toThrow(
    "file_too_large",
  );
  expect(
    parseImportCsv(bytes("url\n" + "https://example.com\n".repeat(50_000)))
      .records.length,
  ).toBe(50_000);
  expect(() =>
    parseImportCsv(bytes("url\n" + "https://example.com\n".repeat(50_001))),
  ).toThrow("too_many_rows");
});
test("paste uses the same CSV pipeline and error CSV cells cannot become spreadsheet formulas", () => {
  const table = parseImportCsv(
    pastedImportCsv('https://example.com/?q="value"\n\nhttps://example.org'),
  );
  expect(table.records.map((row) => row.cells[0])).toEqual([
    'https://example.com/?q="value"',
    "https://example.org",
  ]);
  expect(csvCell('=HYPERLINK("evil")')).toBe('"\'=HYPERLINK(""evil"")"');
  expect(csvCell("  =SUM(1)")).toBe('"\'  =SUM(1)"');
  expect(csvCell("@SUM(1)")).toBe('"\'@SUM(1)"');
  expect(csvCell("normal, text")).toBe('"normal, text"');
  expect(() => pastedImportCsv("url\n".repeat(50_001))).toThrow(
    "too_many_rows",
  );
});
