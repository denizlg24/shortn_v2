import { describe, expect, test } from "bun:test";
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
  return [...message.matchAll(/\{(\w+)/g)]
    .map((match) => match[1] ?? "")
    .sort();
}

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
