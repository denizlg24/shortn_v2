import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import {
  parse,
  TYPE,
  type MessageFormatElement,
} from "@formatjs/icu-messageformat-parser";
import en from "../../messages/en/index";

function requiredArguments(message: string) {
  const required = new Set<string>();
  const visit = (elements: MessageFormatElement[]) => {
    for (const element of elements) {
      if (element.type === TYPE.literal || element.type === TYPE.pound)
        continue;
      required.add(element.value);
      if (element.type === TYPE.tag) visit(element.children);
      if (element.type === TYPE.plural || element.type === TYPE.select)
        for (const option of Object.values(element.options))
          visit(option.value);
    }
  };
  visit(parse(message));
  return [...required];
}

// Catalog parity alone cannot catch a key missing from every language. Resolve
// literal translation calls against their lexical hook/server binding as well.
function namespaceOf(node: ts.Expression | undefined): string | undefined {
  if (node && ts.isAwaitExpression(node)) node = node.expression;
  if (!node || !ts.isCallExpression(node) || !ts.isIdentifier(node.expression))
    return;
  if (!["useTranslations", "getTranslations"].includes(node.expression.text))
    return;
  const argument = node.arguments[0];
  if (!argument) return "";
  if (ts.isStringLiteralLike(argument)) return argument.text;
  if (ts.isObjectLiteralExpression(argument)) {
    const property = argument.properties.find(
      (item) =>
        ts.isPropertyAssignment(item) && item.name.getText() === "namespace",
    );
    if (
      property &&
      ts.isPropertyAssignment(property) &&
      ts.isStringLiteralLike(property.initializer)
    )
      return property.initializer.text;
  }
}
function scope(node: ts.Node): ts.Node {
  let parent = node.parent;
  while (parent && !ts.isBlock(parent) && !ts.isSourceFile(parent))
    parent = parent.parent;
  return parent;
}
function missingLiteralKeys(
  code: string,
  filename: string,
  messages: unknown,
): string[] {
  const source = ts.createSourceFile(
    filename,
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const bindings = new Map<ts.Node, Map<string, string | undefined>>();
  const visitBindings = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const owner = scope(node);
      if (!bindings.has(owner)) bindings.set(owner, new Map());
      bindings.get(owner)!.set(node.name.text, namespaceOf(node.initializer));
    }
    if (ts.isVariableDeclaration(node) && ts.isArrayBindingPattern(node.name)) {
      const initializer =
        node.initializer && ts.isAwaitExpression(node.initializer)
          ? node.initializer.expression
          : node.initializer;
      if (
        initializer &&
        ts.isCallExpression(initializer) &&
        ts.isPropertyAccessExpression(initializer.expression) &&
        initializer.expression.expression.getText(source) === "Promise" &&
        initializer.expression.name.text === "all"
      ) {
        const values = initializer.arguments[0];
        if (values && ts.isArrayLiteralExpression(values)) {
          const owner = scope(node);
          if (!bindings.has(owner)) bindings.set(owner, new Map());
          node.name.elements.forEach((element, index) => {
            if (ts.isBindingElement(element) && ts.isIdentifier(element.name))
              bindings
                .get(owner)!
                .set(element.name.text, namespaceOf(values.elements[index]));
          });
        }
      }
    }
    ts.forEachChild(node, visitBindings);
  };
  visitBindings(source);
  const missing: string[] = [];
  const visitCalls = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      const identifier = ts.isIdentifier(expression)
        ? expression
        : ts.isPropertyAccessExpression(expression) &&
            ["raw", "rich", "markup"].includes(expression.name.text) &&
            ts.isIdentifier(expression.expression)
          ? expression.expression
          : null;
      const key = node.arguments[0];
      if (identifier && key && ts.isStringLiteralLike(key)) {
        let owner: ts.Node | undefined = scope(node);
        let namespace: string | undefined;
        while (owner) {
          const bound = bindings.get(owner);
          if (bound?.has(identifier.text)) {
            namespace = bound.get(identifier.text);
            break;
          }
          owner = owner.parent ? scope(owner) : undefined;
        }
        if (namespace !== undefined) {
          const path = [namespace, key.text].filter(Boolean).join(".");
          let value = messages;
          for (const segment of path.split("."))
            value =
              typeof value === "object" && value !== null
                ? Reflect.get(value, segment)
                : undefined;
          if (value === undefined)
            missing.push(
              `${filename}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1} ${path}`,
            );
          else if (
            typeof value === "string" &&
            !(
              ts.isPropertyAccessExpression(expression) &&
              expression.name.text === "raw"
            )
          ) {
            const supplied = node.arguments[1];
            // Forwarded values and spreads require runtime coverage; check
            // calls whose supplied argument names are statically known.
            if (
              !supplied ||
              (ts.isObjectLiteralExpression(supplied) &&
                !supplied.properties.some(ts.isSpreadAssignment))
            ) {
              const names =
                supplied && ts.isObjectLiteralExpression(supplied)
                  ? supplied.properties.flatMap((property) =>
                      property.name &&
                      (ts.isIdentifier(property.name) ||
                        ts.isStringLiteralLike(property.name))
                        ? [property.name.text]
                        : [],
                    )
                  : [];
              const absent = requiredArguments(value).filter(
                (name) => !names.includes(name),
              );
              if (absent.length)
                missing.push(
                  `${filename}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1} ${path} missing arguments: ${absent.join(", ")}`,
                );
            }
          }
        }
      }
    }
    ts.forEachChild(node, visitCalls);
  };
  visitCalls(source);
  return missing;
}

test("literal translation calls exist, including keys absent from every catalog", async () => {
  const root = new URL("../", import.meta.url).pathname;
  const missing: string[] = [];
  for await (const file of new Bun.Glob("**/*.{ts,tsx}").scan(root)) {
    if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) continue;
    missing.push(
      ...missingLiteralKeys(await readFile(`${root}${file}`, "utf8"), file, en),
    );
  }
  expect(missing).toEqual([]);
});

test("translation scan resolves distinct namespaces in sibling functions", () => {
  const code = `function A(){ const t = useTranslations("first"); t("present"); t("missing"); } function B(){ const t = await getTranslations("second"); t("present"); }`;
  expect(
    missingLiteralKeys(code, "fixture.tsx", {
      first: { present: "yes" },
      second: { present: "yes" },
    }),
  ).toEqual(["fixture.tsx:1 first.missing"]);
});

test("translation scan catches missing ICU values in populated states", () => {
  const code = `const t = useTranslations("invites"); t("expires"); t("by", {}); t("expires", {when: "tomorrow"}); t.raw("expires"); t("by", forwarded); t("by", {...forwarded});`;
  expect(
    missingLiteralKeys(code, "fixture.tsx", {
      invites: { expires: "Expires {when}", by: "Invited by {name}" },
    }),
  ).toEqual([
    "fixture.tsx:1 invites.expires missing arguments: when",
    "fixture.tsx:1 invites.by missing arguments: name",
  ]);
});

test("translation scan resolves translators destructured from Promise.all", () => {
  const code = `async function Page(){ const [query, t] = await Promise.all([searchParams, getTranslations("invites")]); t("expires"); t("by", {name: "Owner"}); }`;
  expect(
    missingLiteralKeys(code, "page.tsx", {
      invites: { expires: "Expires {when}", by: "Invited by {name}" },
    }),
  ).toEqual(["page.tsx:1 invites.expires missing arguments: when"]);
});
