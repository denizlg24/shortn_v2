import { describe, expect, test } from "bun:test";
import { isTypingTarget } from "@shortn/ui";

function input(type: string): HTMLInputElement {
  const element = document.createElement("input");
  element.type = type;
  return element;
}

describe("isTypingTarget", () => {
  test("text-entry fields swallow shortcuts", () => {
    for (const type of ["text", "search", "url", "email", "number"]) {
      expect(isTypingTarget(input(type))).toBe(true);
    }
    expect(isTypingTarget(document.createElement("textarea"))).toBe(true);
    expect(isTypingTarget(document.createElement("select"))).toBe(true);
  });

  test("toggle and button inputs do not", () => {
    for (const type of [
      "checkbox",
      "radio",
      "button",
      "submit",
      "reset",
      "range",
      "color",
    ]) {
      expect(isTypingTarget(input(type))).toBe(false);
    }
  });

  test("editable regions and comboboxes swallow shortcuts", () => {
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    const combobox = document.createElement("button");
    combobox.setAttribute("role", "combobox");

    expect(isTypingTarget(editable)).toBe(true);
    expect(isTypingTarget(combobox)).toBe(true);
  });

  test("plain elements and non-elements do not", () => {
    expect(isTypingTarget(document.createElement("div"))).toBe(false);
    expect(isTypingTarget(document)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
