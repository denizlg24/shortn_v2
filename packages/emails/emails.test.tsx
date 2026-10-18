import { describe, expect, spyOn, test } from "bun:test";
import { catalog, sample } from "./catalog";
import { formatCard, formatMoney, plainLine } from "./format";
import { createMailer, logoUrl, recipientAllowed } from "./index";
import { locales, messages, operatorMessages } from "./messages";
import { renderEmail } from "./render";
import { VerifyEmail } from "./templates/account";
import { ProductAnnouncement } from "./templates/announcement";
import { BillingEmail, type PaymentFailure } from "./templates/billing";
import { ContactNotification } from "./templates/contact";
import {
  BillingReceipt,
  BillingRefund,
  type Receipt,
} from "./templates/receipt";
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
    for (const change of t.changes(t.bioPlaceholder)) {
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

test("the announcement shows the reader's own bio address when known", async () => {
  const own = await renderEmail(
    <ProductAnnouncement
      locale="en"
      handle=" VidaEconomica "
      url="https://app.shortn.at"
    />,
  );
  expect(own.text).toContain("Your page now lives at vidaeconomica.shortn.at.");
  for (const handle of ["", "bad handle", "-x", "a.b"]) {
    const generic = await renderEmail(
      <ProductAnnouncement
        locale="en"
        handle={handle}
        url="https://app.shortn.at"
      />,
    );
    expect(generic.text).toContain(
      "Your page now lives at yourname.shortn.at.",
    );
  }
});

describe("formatting", () => {
  test("money uses the currency's own minor unit and the reader's locale", () => {
    expect(formatMoney(1476, "eur", "en")).toBe("€14.76");
    expect(formatMoney(1476, "EUR", "pt")).toBe("14,76\u00a0€");
    expect(formatMoney(1476, "eur", "es")).toBe("14,76\u00a0€");
    expect(formatMoney(-300, "eur", "en")).toBe("-€3.00");
    expect(formatMoney(1500, "jpy", "en")).toBe("JP¥1,500");
    expect(formatMoney(1500, "kwd", "en")).toBe("KWD\u00a01.500");
    expect(formatMoney(999, "usd", "en")).toBe("US$9.99");
  });

  test("cards read as brand and last four", () => {
    expect(formatCard({ brand: "visa", last4: "4242" }, "Card")).toBe(
      "Visa •••• 4242",
    );
    expect(formatCard({ brand: "amex", last4: "0005" }, "Card")).toBe(
      "American Express •••• 0005",
    );
    expect(formatCard({ brand: "link_card", last4: "x1234" }, "Card")).toBe(
      "Link Card •••• 1234",
    );
    expect(formatCard({ brand: "", last4: "4242" }, "Cartão")).toBe(
      "Cartão •••• 4242",
    );
  });

  test("provider text is one short, clean line", () => {
    expect(plainLine("  Your card\nwas <b>declined</b>.\u0007 ")).toBe(
      "Your card was b declined /b .",
    );
    expect(plainLine("")).toBeUndefined();
    expect(plainLine(null)).toBeUndefined();
    expect(plainLine("x".repeat(200))?.length).toBe(140);
  });
});

const receiptFor = (overrides: Partial<Receipt> = {}): Receipt => ({
  reason: "subscription_create",
  plan: "Pro",
  product: "Shortn Pro",
  currency: "eur",
  items: [{ label: "Shortn Pro", amount: 1500 }],
  subtotal: 1500,
  discount: { amount: 300, name: "Launch offer", code: "LAUNCH20" },
  tax: 276,
  appliedBalance: 0,
  total: 1476,
  card: { brand: "visa", last4: "4242" },
  invoiceNumber: "SHORTN-2026-0042",
  period: {
    start: new Date("2026-10-01T12:00:00Z"),
    end: new Date("2026-11-01T12:00:00Z"),
  },
  nextRenewal: new Date("2026-11-01T12:00:00Z"),
  ...overrides,
});

const renderReceipt = (receipt: Receipt, locale: "en" | "pt" | "es" = "en") =>
  renderEmail(
    <BillingReceipt
      locale={locale}
      workspace="Vida Económica"
      receipt={receipt}
      url="https://app.shortn.at/vida/settings/billing"
    />,
  );

describe("receipts", () => {
  test("a discounted, taxed receipt adds up line by line", async () => {
    const { html, text } = await renderReceipt(receiptFor());
    expect(text).toContain("You're on Pro");
    expect(text).toMatch(/Shortn Pro\s+€15\.00/);
    expect(text).toMatch(/Subtotal\s+€15\.00/);
    expect(text).toMatch(/Discount · Launch offer \(LAUNCH20\)\s+-€3\.00/);
    expect(text).toMatch(/Tax\s+€2\.76/);
    expect(text).toMatch(/Total\s+€14\.76/);
    expect(text).not.toContain("Balance applied");
    expect(text).toMatch(/Paid with\s+Visa •••• 4242/);
    expect(text).toMatch(/Invoice\s+SHORTN-2026-0042/);
    expect(text).toMatch(/Billing period\s+1 October – 1 November 2026/);
    expect(text).toMatch(/Next renewal\s+1 November 2026/);
    expect(html).toContain(
      'href="https://app.shortn.at/vida/settings/billing"',
    );
  });

  test("the heading follows why Polar billed", async () => {
    const heading = async (overrides: Partial<Receipt>) =>
      (await renderReceipt(receiptFor(overrides))).text.split("\n")[0];
    expect(await heading({ reason: "subscription_update" })).toBe(
      "You've moved to Pro",
    );
    expect(await heading({ reason: "subscription_cycle" })).toBe(
      "Your Pro plan renewed",
    );
    expect(await heading({ reason: "purchase" })).toBe(
      "Receipt for Shortn Pro",
    );
    expect(await heading({ plan: undefined, product: "Custom domains" })).toBe(
      "Receipt for Custom domains",
    );
  });

  test("a zero total shows no card, and a balance changes what was paid", async () => {
    const free = await renderReceipt(
      receiptFor({
        discount: { amount: 1500, name: "Press partners", code: null },
        tax: 0,
        total: 0,
        card: undefined,
      }),
    );
    expect(free.text).toMatch(/Total\s+€0\.00/);
    expect(free.text).not.toContain("Paid with");
    const credited = await renderReceipt(receiptFor({ appliedBalance: -500 }));
    expect(credited.text).toMatch(/Balance applied\s+-€5\.00/);
    expect(credited.text).toMatch(/Total\s+€9\.76/);
  });

  test("receipts are localized end to end", async () => {
    const { text } = await renderReceipt(receiptFor(), "pt");
    expect(text).toContain("Está no plano Pro");
    expect(text).toMatch(/Desconto · Launch offer \(LAUNCH20\)\s+-3,00\u00a0€/);
    expect(text).toMatch(
      /Período de faturação\s+1 de outubro – 1 de novembro de 2026/,
    );
  });

  test("a refund shows the amount with tax, the card and the reference", async () => {
    const { text } = await renderEmail(
      <BillingRefund
        locale="en"
        workspace="Vida Económica"
        refund={{
          currency: "eur",
          refunded: 1200,
          refundedTax: 276,
          originalTotal: 1476,
          product: "Shortn Pro",
          card: { brand: "visa", last4: "4242" },
          reference: "SHORTN-2026-0042",
        }}
        url="https://app.shortn.at/vida/settings/billing"
      />,
    );
    expect(text).toContain("€14.76 is on its way back to your card.");
    expect(text).toMatch(/Refunded\s+€14\.76/);
    expect(text).toMatch(/Includes tax\s+€2\.76/);
    expect(text).toMatch(/Refunded to\s+Visa •••• 4242/);
    expect(text).toMatch(/Reference\s+SHORTN-2026-0042/);
  });
});

describe("failed payments", () => {
  const failure: PaymentFailure = {
    currency: "eur",
    amountDue: 1476,
    card: { brand: "visa", last4: "9995" },
    declineReason: "insufficient_funds",
    declineMessage: "Your card has insufficient funds.",
    nextAttemptAt: new Date("2026-11-04T12:00:00Z"),
  };
  const render = (locale: "en" | "pt" | "es", details: PaymentFailure) =>
    renderEmail(
      <BillingEmail
        locale={locale}
        workspace="Vida"
        notice={{ kind: "payment_failed", failure: details }}
        url="https://app.shortn.at/w/settings/billing"
      />,
    );

  test("details replace the generic status rows", async () => {
    const { text } = await render("en", failure);
    expect(text).toMatch(/Amount due\s+€14\.76/);
    expect(text).toMatch(/Card\s+Visa •••• 9995/);
    expect(text).toMatch(/Reason\s+Insufficient funds/);
    expect(text).toMatch(/Next attempt\s+4 November 2026/);
    expect(text).not.toContain("Grace period");
  });

  test("decline codes are translated; raw processor text stays English-only", async () => {
    expect((await render("es", failure)).text).toContain(
      "Fondos insuficientes",
    );
    const unknown = {
      ...failure,
      declineReason: "do_not_honor",
      declineMessage: "Your card was declined.\u0000",
    };
    expect((await render("en", unknown)).text).toMatch(
      /Reason\s+Your card was declined\./,
    );
    expect((await render("pt", unknown)).text).toMatch(
      /Motivo\s+O cartão foi recusado/,
    );
    const bare = { ...failure, declineReason: null, declineMessage: null };
    expect((await render("en", bare)).text).toMatch(
      /Reason\s+The card was declined/,
    );
  });
});

describe("brand mark", () => {
  test("a hosted mark keeps a styled text fallback", async () => {
    const logo = "https://app.shortn.at/email/mark@2x.png";
    const { html, text } = await renderEmail(
      <ProductAnnouncement locale="en" url="https://app.shortn.at" />,
      { logoUrl: logo },
    );
    expect(html).toContain(`src="${logo}"`);
    expect(html).toMatch(/<img[^>]+alt="S"/);
    expect(text).not.toContain(logo);
    const plain = await renderEmail(
      <ProductAnnouncement locale="en" url="https://app.shortn.at" />,
    );
    expect(plain.html).not.toContain("<img");
  });

  test("only an https origin serves the mark", () => {
    expect(logoUrl("https://app.shortn.at")).toBe(
      "https://app.shortn.at/email/mark@2x.png",
    );
    expect(logoUrl("https://app.shortn.at/")).toBe(
      "https://app.shortn.at/email/mark@2x.png",
    );
    expect(logoUrl("http://localhost:3000")).toBeUndefined();
    expect(logoUrl(undefined)).toBeUndefined();
  });
});

test("only the announcement send carries List-Unsubscribe", async () => {
  const bodies: unknown[] = [];
  const fetch = spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)));
        return Response.json({ id: "email_1" });
      },
      { preconnect: globalThis.fetch.preconnect },
    ),
  );
  try {
    const mailer = createMailer({
      apiKey: "re_test",
      from: "Shortn <no-reply@shortn.at>",
      assetOrigin: "https://app.shortn.at",
    });
    await mailer.productAnnouncement({
      to: "a@example.test",
      locale: "en",
      url: "https://app.shortn.at",
    });
    await mailer.resetPassword({
      to: "a@example.test",
      locale: "en",
      url: "https://app.shortn.at/reset",
    });
  } finally {
    fetch.mockRestore();
  }
  expect(bodies).toHaveLength(2);
  expect(bodies[0]).toMatchObject({
    headers: {
      "List-Unsubscribe": "<mailto:support@shortn.at?subject=unsubscribe>",
    },
  });
  expect(bodies[0]).toMatchObject({
    html: expect.stringContaining("https://app.shortn.at/email/mark@2x.png"),
  });
  expect(bodies[1]).not.toHaveProperty("headers");
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
