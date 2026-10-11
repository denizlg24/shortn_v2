import { describe, expect, test } from "bun:test";
import {
  parse,
  TYPE,
  type MessageFormatElement,
} from "@formatjs/icu-messageformat-parser";
import en from "../../messages/en/index";
import es from "../../messages/es/index";
import pt from "../../messages/pt/index";

function keyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keyPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

function placeholders(message: string): string[] {
  const argumentsFound = new Set<string>();
  const visit = (elements: MessageFormatElement[]) => {
    for (const element of elements) {
      if (element.type === TYPE.literal || element.type === TYPE.pound)
        continue;
      if (element.type === TYPE.tag) {
        visit(element.children);
        continue;
      }
      argumentsFound.add(element.value);
      if (element.type === TYPE.plural || element.type === TYPE.select)
        for (const option of Object.values(element.options))
          visit(option.value);
    }
  };
  visit(parse(message));
  return [...argumentsFound].sort();
}

test("ICU arguments exclude translated plural text and include nested arguments", () => {
  expect(
    placeholders(
      "{count, plural, =0 {No links} one {# link for {name}} other {# links for {name}}}",
    ),
  ).toEqual(["count", "name"]);
  expect(
    placeholders(
      "<strong>{name}</strong> {count, plural, =0 {Sem ligações} other {# ligações}}",
    ),
  ).toEqual(["count", "name"]);
});

function messageAt(messages: unknown, path: string): string {
  let node: unknown = messages;
  for (const key of path.split(".")) {
    node =
      typeof node === "object" && node !== null
        ? Reflect.get(node, key)
        : undefined;
  }
  return typeof node === "string" ? node : "";
}

const english = keyPaths(en).sort();

describe.each([
  ["pt", pt],
  ["es", es],
] as const)("%s messages", (_locale, messages) => {
  test("have exactly the English keys", () => {
    expect(keyPaths(messages).sort()).toEqual(english);
  });

  test("use the same ICU arguments as English", () => {
    for (const path of english)
      expect({ path, args: placeholders(messageAt(messages, path)) }).toEqual({
        path,
        args: placeholders(messageAt(en, path)),
      });
  });
});
