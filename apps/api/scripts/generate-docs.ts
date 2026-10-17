import { readdir } from "node:fs/promises";
import { Marked } from "marked";
import { format } from "prettier";
import { generatedContracts } from "./generate-contracts";

const escape = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
// Authored Markdown only: raw HTML is displayed as text, never executed.
const markdown = new Marked({ renderer: { html: ({ text }) => escape(text) } });
const sourceDirectory = new URL("../../../docs/api/", import.meta.url);
const guidesDirectory = new URL("../../../docs/guides/", import.meta.url);
const guideLocales = ["en", "pt", "es"] as const;
const output = new URL(
  "../../../packages/docs/generated.json",
  import.meta.url,
);
const code = (value: unknown) =>
  `\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n`;

export async function generateDocumentation() {
  const contracts = await generatedContracts();
  const specText = [...contracts].find(([path]) =>
    path.pathname.endsWith("/openapi.json"),
  )?.[1];
  if (!specText) throw new Error("OpenAPI contract missing");
  const spec = JSON.parse(specText);
  spec.servers = [{ url: "https://api.shortn.at" }];
  const pages: Record<
    string,
    {
      title: string;
      markdown: string;
      html: string;
      locale?: (typeof guideLocales)[number];
      guide?: string;
    }
  > = {};
  for (const filename of (await readdir(sourceDirectory)).sort()) {
    if (!/\.mdx?$/.test(filename)) continue;
    const slug = filename.replace(/\.mdx?$/, "");
    const text = await Bun.file(new URL(filename, sourceDirectory)).text();
    // These docs use the Markdown subset of MDX; JSX would not be portable to .md.
    if (/^import\s|^export\s|<[A-Z]/m.test(text))
      throw new Error(`Unsupported MDX component in ${filename}`);
    const title = /^# (.+)$/m.exec(text)?.[1];
    if (!title) throw new Error(`Missing title in ${filename}`);
    pages[slug] = { title, markdown: text, html: await markdown.parse(text) };
  }
  // User guides (21 M1-a): /docs/{locale}/guides/{path}, in every locale.
  for (const locale of guideLocales) {
    const root = new URL(`${locale}/`, guidesDirectory);
    const files = (await readdir(root, { recursive: true }))
      .filter((file) => /\.md$/.test(file))
      .sort();
    for (const file of files) {
      const path = file.replace(/\.md$/, "").replaceAll("\\", "/");
      const text = await Bun.file(new URL(file, root)).text();
      if (/^import\s|^export\s|<[A-Z]/m.test(text))
        throw new Error(
          `Unsupported MDX component in guides/${locale}/${file}`,
        );
      const title = /^# (.+)$/m.exec(text)?.[1];
      if (!title) throw new Error(`Missing title in guides/${locale}/${file}`);
      pages[
        path === "index" ? `${locale}/guides` : `${locale}/guides/${path}`
      ] = {
        title,
        markdown: text,
        html: await markdown.parse(text),
        locale,
        guide: path === "index" ? "" : path,
      };
    }
  }
  let reference =
    "# Shortn API reference\n\nBase URL: `https://api.shortn.at`. Authenticate with a scoped bearer API key.\n\nThis reference is generated from the implemented OpenAPI contract.\n";
  for (const [path, methods] of Object.entries(
    spec.paths as Record<string, Record<string, unknown>>,
  )) {
    for (const [method, value] of Object.entries(methods)) {
      if (
        !["get", "post", "patch", "put", "delete", "head", "options"].includes(
          method,
        )
      )
        continue;
      const operation = value as Record<string, unknown>;
      reference += `\n## ${method.toUpperCase()} ${path}\n\n`;
      if (operation.summary) reference += `${operation.summary}\n\n`;
      if (operation.description) reference += `${operation.description}\n\n`;
      // Preserve all parameter constraints, request/response schemas, scopes and extension metadata.
      reference += code(operation);
    }
  }
  reference +=
    "\n## Shared schemas and authentication\n" + code(spec.components);
  pages.api = { title: "Shortn API reference", markdown: reference, html: "" };
  const origin = "https://shortn.at";
  const index =
    "# Shortn\n\n> Workspace link management, QR codes, campaigns, bio pages and analytics.\n\nAPI access is subject to workspace rollout, key scopes and current role permissions.\n\n## Documentation\n\n" +
    Object.entries(pages)
      .map(
        ([slug, page]) =>
          `- [${page.title}](${origin}${slug === "index" ? "/docs" : `/docs/${slug}`}.md)`,
      )
      .join("\n") +
    `\n- [Interactive API reference](${origin}/docs/api)\n- [OpenAPI specification](${origin}/openapi.json)\n- [Complete documentation](${origin}/llms-full.txt)\n`;
  const full =
    index +
    "\n---\n\n" +
    Object.values(pages)
      .map((page) => page.markdown)
      .join("\n\n---\n\n");
  return format(JSON.stringify({ spec, pages, index, full }), {
    parser: "json",
  });
}

if (import.meta.main) {
  const generated = await generateDocumentation();
  if (process.argv.includes("--check")) {
    if (
      !(await Bun.file(output).exists()) ||
      (await Bun.file(output).text()) !== generated
    ) {
      console.error("Generated documentation differs; run bun run gen:llms");
      process.exitCode = 1;
    }
  } else await Bun.write(output, generated);
}
