import { describe, expect, test } from "bun:test";
import { catalog, sample } from "./catalog";
import { recipientAllowed } from "./index";
import { locales, messages, operatorMessages } from "./messages";
import { renderEmail } from "./render";
import { VerifyEmail } from "./templates/account";
import { ProductAnnouncement } from "./templates/announcement";
import { BillingEmail } from "./templates/billing";
import { ContactNotification } from "./templates/contact";
import { WebhookDisabled } from "./templates/webhook";

const brokenOutput = /\bundefined\b|\bnull\b|\[object Object\]|\bNaN\b/;

const decode = (html: string) =>
  html
    .replaceAll("&#x27;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");

/** Structural fingerprint: same keys, value kinds, arity and array lengths. */
function shape(value: unknown): unknown {
  if (typeof value === "function") return `function/${value.length}`;
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, shape(entry)]),
    );
  return typeof value;
}

/** Every string in the tree, calling copy functions with sample arguments. */
function strings(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (typeof value === "function") {
    const output: unknown = value(
      ...Array.from({ length: value.length }, () => "Sample"),
    );
    return strings(output, `${path}(Sample)`);
  }
  if (Array.isArray(value))
    return value.flatMap((entry, index) => strings(entry, `${path}[${index}]`));
  if (value && typeof value === "object")
    return Object.entries(value).flatMap(([key, entry]) =>
      strings(entry, path ? `${path}.${key}` : key),
    );
  return [[path, `unexpected ${typeof value}`]];
}

test("allowlist matches exact addresses and domain suffixes", () => {
  expect(recipientAllowed(undefined, "a@b.com")).toBe(true);
  expect(recipientAllowed("", "a@b.com")).toBe(true);
  expect(recipientAllowed("@shortn.at, me@x.com", "Ops@Shortn.at")).toBe(true);
  expect(recipientAllowed("@shortn.at, me@x.com", "me@x.com")).toBe(true);
  expect(
    recipientAllowed("@shortn.at, me@x.com", "someone@evil-shortn.at.com"),
  ).toBe(false);
  expect(recipientAllowed("@shortn.at", "customer@gmail.com")).toBe(false);
});

describe("copy", () => {
  test("pt and es define exactly the strings en defines", () => {
    for (const locale of locales)
      expect(shape(messages[locale])).toEqual(shape(messages.en));
  });

  test("no locale has an empty or broken string", () => {
    for (const locale of locales)
      for (const [path, text] of strings(messages[locale])) {
        expect(text.trim(), `${locale}.${path}`).not.toBe("");
        expect(text, `${locale}.${path}`).not.toMatch(brokenOutput);
        expect(text, `${locale}.${path}`).not.toMatch(/^,|\s,|\s{2,}/);
      }
    for (const [path, text] of strings(operatorMessages))
      expect(text.trim(), path).not.toBe("");
  });
});

describe.each([...locales])("every email renders in %s", (locale) => {
  const htmlLang = { en: "en", pt: "pt-PT", es: "es" }[locale];
  const entries = catalog(locale);

  test.each(entries.map((entry) => [entry.slug, entry] as const))(
    "%s",
    async (_, entry) => {
      const { html, text } = await renderEmail(entry.element);
      const heading = decode(
        /<h1[^>]*>([^<]+)<\/h1>/.exec(html)?.[1]?.trim() ?? "",
      );

      expect(entry.subject.trim()).not.toBe("");
      expect(entry.subject).not.toMatch(brokenOutput);
      expect(heading).toBeTruthy();
      expect(text).toContain(heading);
      expect(html).not.toMatch(brokenOutput);
      expect(text).not.toMatch(brokenOutput);
      expect(html).toContain(
        `lang="${entry.slug === "contact-notification" ? "en" : htmlLang}"`,
      );
      expect(html).toContain('<meta name="color-scheme" content="light"');
      expect(html).toContain(
        '<meta name="supported-color-schemes" content="light"',
      );
      expect(html).not.toMatch(/gradient|box-shadow/i);
      for (const url of entry.urls) expect(html).toContain(`href="${url}"`);
      expect(text).toContain("shortn.at");
      expect(text.trimStart().startsWith("Shortn\n")).toBe(false);
    },
  );
});

test("data rows survive into the plain-text part as aligned pairs", async () => {
  const { text } = await renderEmail(
    <BillingEmail
      locale="en"
      workspace={sample.workspace}
      notice={{ kind: "scheduled", plan: "Basic", date: sample.date }}
      url="https://app.shortn.at/w/settings/billing"
    />,
  );
  expect(text).toMatch(/Workspace\s+Vida Económica/);
  expect(text).toMatch(/New plan\s+Basic/);
  expect(text).toMatch(/Starts on\s+12 November 2026/);
});

test("a failed payment asks the owner to update the payment method", async () => {
  for (const locale of locales) {
    const { html } = await renderEmail(
      <BillingEmail
        locale={locale}
        workspace="Vida"
        notice={{ kind: "payment_failed" }}
        url="https://app.shortn.at/w/settings/billing"
      />,
    );
    expect(html).toContain(messages[locale].billing.paymentAction);
    expect(html).not.toContain(`>${messages[locale].billing.action}<`);
  }
});

test("verification only greets people by name, never by address", async () => {
  const named = await renderEmail(
    <VerifyEmail locale="en" name="Ana" url="https://x.y/v" reason="signup" />,
  );
  expect(named.text).toContain("Hi Ana,");
  const fallback = await renderEmail(
    <VerifyEmail
      locale="en"
      name="ana@example.com"
      url="https://x.y/v"
      reason="signup"
    />,
  );
  expect(fallback.text).not.toContain("ana@example.com");
  expect(fallback.text).toContain(messages.en.verify.body(""));
});

test("the announcement lists every change and reads well without a name", async () => {
  for (const locale of locales) {
    const t = messages[locale].announcement;
    const { html, text } = await renderEmail(
      <ProductAnnouncement locale={locale} url="https://app.shortn.at" />,
    );
    expect(text).toContain(t.intro(""));
    expect(text).not.toMatch(/^,/m);
    for (const change of t.changes) {
      expect(text).toContain(change.title);
      expect(text).toContain(change.body);
    }
    expect(text).toContain(t.note);
    expect(text).toContain(messages[locale].footer.announcement);
    expect(html).toContain('href="https://app.shortn.at"');
  }
  const named = await renderEmail(
    <ProductAnnouncement
      locale="pt"
      name=" Ana "
      url="https://app.shortn.at"
    />,
  );
  expect(named.text).toContain("Ana, reconstruímos o Shortn");
});

test("webhook email escapes receiver names and shows the endpoint only when known", async () => {
  for (const locale of locales) {
    const { html, text } = await renderEmail(
      <WebhookDisabled
        locale={locale}
        name={"<script>receiver</script>"}
        url="https://app.shortn.at/workspace/settings"
      />,
    );
    expect(html).not.toContain("<script>");
    expect(text).toContain("<script>receiver</script>");
    expect(text).not.toContain(messages[locale].webhook.endpoint);
    expect(text).toContain("https://app.shortn.at/workspace/settings");
  }
  const withEndpoint = await renderEmail(
    <WebhookDisabled
      locale="en"
      name="Receiver"
      endpoint={sample.endpoint}
      url="https://app.shortn.at/workspace/settings"
    />,
  );
  expect(withEndpoint.text).toContain(`Endpoint\n${sample.endpoint}`);
});

test("contact messages keep their line breaks and escape markup", async () => {
  const { html, text } = await renderEmail(
    <ContactNotification
      reference={sample.reference}
      name="Ana"
      email="ana@example.com"
      topic="Sales"
      locale="pt"
      message={"First line\n<b>second</b> line"}
    />,
  );
  expect(html).not.toContain("<b>second</b>");
  expect(text).toContain("First line\n<b>second</b> line");
  expect(text).toContain("Portuguese");
  expect(text).not.toContain(operatorMessages.company);
});
