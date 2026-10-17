import { expect, test } from "bun:test";
import {
  encodeLinkExport,
  linkCsvColumns,
  linkCsvRecord,
  type ExportedLink,
} from "./link-format";
import {
  detectImportMapping,
  mapImportRecord,
  parseImportCsv,
} from "../imports/csv";

const row: ExportedLink = {
  url: "https://example.com/a?utm_source=one&utm_source=two&encoded=%2F#part",
  key: "news",
  title: '=HYPERLINK("evil")',
  tags: ["News, North", "Weekly;Edition", "São João", "'=literal", "@SUM(1)"],
  domain: "shortn.invalid",
  expires_at: "2027-01-01T12:00:00.000Z",
  created_at: "2026-10-15T12:00:00.000Z",
  clicks: 12,
};
const bytes = (value: string) => new TextEncoder().encode(value);
test("versioned CSV is formula-safe and preserves destinations, delimiter-bearing tags and literal apostrophes", () => {
  for (const title of [
    row.title,
    "'=already quoted",
    "'literal",
    "+SUM(1)",
    "@SUM(1)",
    "-SUM(1)",
    'São João, "edição"\nsemanal',
  ]) {
    const table = parseImportCsv(
      bytes(
        linkCsvColumns.join(",") + "\r\n" + linkCsvRecord({ ...row, title }),
      ),
    );
    const rawTitle = table.records[0]!.cells[3]!;
    expect(/^(?:\s*[=+\-@]|[\t\r\n])/.test(rawTitle)).toBe(false);
    expect(
      mapImportRecord(
        table,
        detectImportMapping(table.columns),
        table.records[0]!,
      ),
    ).toEqual({
      ok: true,
      input: {
        url: row.url,
        key: row.key,
        title,
        tags: row.tags,
        domain: row.domain,
        rules: { expiresAt: row.expires_at },
      },
    });
  }
});
test("own CSV version and tag representation fail closed without affecting ordinary CSV", () => {
  for (const version of ["", "future-version"]) {
    const table = parseImportCsv(
      bytes(`shortn_format,url,tags\n${version},https://example.com,[]`),
    );
    expect(
      mapImportRecord(
        table,
        detectImportMapping(table.columns),
        table.records[0]!,
      ),
    ).toMatchObject({ ok: false, error: "invalid_mapping" });
  }
  for (const tags of [
    '["ok",1]',
    '{"tag":"x"}',
    '"wrong"',
    "not-json",
    JSON.stringify(Array.from({ length: 51 }, (_, i) => String(i))),
  ]) {
    const line = `shortn-csv-v1,https://example.com,"${tags.replaceAll('"', '""')}"`;
    const table = parseImportCsv(bytes(`shortn_format,url,tags\n${line}`));
    expect(
      mapImportRecord(
        table,
        detectImportMapping(table.columns),
        table.records[0]!,
      ),
    ).toMatchObject({ ok: false, error: "invalid_tags" });
  }
  const ordinary = parseImportCsv(
    bytes("url,title,tags\nhttps://example.com,'literal,North;South"),
  );
  expect(
    mapImportRecord(
      ordinary,
      detectImportMapping(ordinary.columns),
      ordinary.records[0]!,
    ),
  ).toMatchObject({
    ok: true,
    input: { title: "'literal", tags: ["North", "South"] },
  });
});
test("CSV/JSON encoders stream rows and produce valid empty and populated output", async () => {
  for (const format of ["csv", "json"] as const)
    for (const count of [0, 2, 5001]) {
      let produced = 0,
        chunks = 0,
        output = "";
      const rows = async function* () {
        for (let i = 0; i < count; i++) {
          produced++;
          yield { ...row, key: `row-${i}` };
        }
      };
      for await (const chunk of encodeLinkExport(rows(), format)) {
        chunks++;
        if (chunks === 1) expect(produced).toBe(0);
        expect(chunk.byteLength).toBeLessThan(1024);
        output += new TextDecoder().decode(chunk);
      }
      expect(produced).toBe(count);
      if (format === "json") {
        const values = JSON.parse(output);
        expect(values).toHaveLength(count);
        if (count) expect(values[0]).toEqual({ ...row, key: "row-0" });
      } else expect(parseImportCsv(bytes(output)).records).toHaveLength(count);
    }
});
