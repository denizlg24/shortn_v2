// Renders every email to static files in packages/emails/.preview/ for
// review in a browser: `bun run --cwd packages/emails preview`. English plus
// the announcement in every locale by default; `-- --all` renders every
// email in every locale.
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { catalog, type CatalogEntry } from "../catalog";
import { locales, type Locale } from "../messages";
import { renderEmail } from "../render";

const outDir = fileURLToPath(new URL("../.preview/", import.meta.url));
// The mark the mailer links to on the dashboard origin, copied alongside.
const mark = fileURLToPath(
  new URL("../../../apps/web/public/email/mark@2x.png", import.meta.url),
);

const everyLocale = process.argv.includes("--all");

const selection: { locale: Locale; entries: CatalogEntry[] }[] = locales.map(
  (locale) => ({
    locale,
    entries: catalog(locale).filter(
      (entry) =>
        everyLocale ||
        locale === "en" ||
        entry.slug.startsWith("product-announcement"),
    ),
  }),
);

const escape = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
await copyFile(mark, `${outDir}mark@2x.png`);

const rows: string[] = [];
const frames: string[] = [];
for (const { locale, entries } of selection)
  for (const entry of entries) {
    const file = `${entry.slug}.${locale}`;
    const { html, text } = await renderEmail(entry.element, {
      logoUrl: "mark@2x.png",
    });
    await writeFile(`${outDir}${file}.html`, html);
    await writeFile(
      `${outDir}${file}.txt`,
      `Subject: ${entry.subject}\n\n${text}`,
    );
    rows.push(
      `<tr><td>${escape(entry.title)}</td><td class="mono">${locale}</td><td>${escape(entry.subject)}</td><td><a href="${file}.html">HTML</a> · <a href="${file}.txt">Text</a></td></tr>`,
    );
    frames.push(
      `<figure><figcaption>${escape(entry.title)} <span class="mono">${locale}</span></figcaption><iframe src="${file}.html" title="${escape(entry.title)} (${locale})" loading="lazy"></iframe></figure>`,
    );
  }

await writeFile(
  `${outDir}index.html`,
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Shortn email previews</title>
<style>
  body { margin: 0; padding: 40px 24px; font: 14px/20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #0f172b; }
  h1 { font-size: 28px; line-height: 32px; letter-spacing: -0.8px; margin: 0 0 8px; }
  h2 { font-size: 16px; margin: 40px 0 16px; }
  p { color: #505869; margin: 0 0 24px; }
  table { border-collapse: collapse; width: 100%; max-width: 1100px; }
  th, td { text-align: left; padding: 10px 12px 10px 0; border-top: 1px solid #e3e6ed; vertical-align: top; }
  th { color: #505869; font-weight: 500; font-size: 12px; }
  a { color: #2c67dc; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: #505869; }
  .wall { display: flex; flex-wrap: wrap; gap: 24px; }
  figure { margin: 0; }
  figcaption { font-size: 12px; color: #505869; margin-bottom: 6px; }
  iframe { width: 375px; height: 860px; border: 1px solid #e3e6ed; border-radius: 8px; }
</style>
</head>
<body>
<h1>Shortn email previews</h1>
<p>Rendered from packages/emails/catalog.tsx sample data. The phone wall below shows each email at 375px.</p>
<table>
<thead><tr><th>Email</th><th>Locale</th><th>Subject</th><th>Files</th></tr></thead>
<tbody>
${rows.join("\n")}
</tbody>
</table>
<h2>At 375px</h2>
<div class="wall">
${frames.join("\n")}
</div>
</body>
</html>
`,
);

console.info(`Wrote ${rows.length} emails to ${outDir}`);
