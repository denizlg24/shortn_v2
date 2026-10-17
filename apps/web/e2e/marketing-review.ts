/** Batched review captures and a 390 px overflow sweep for the marketing site. */
import { chromium } from "playwright-core";

const origin = process.env.MARKETING_ORIGIN ?? "http://localhost:3400";
const out = new URL(
  "../../../.impeccable/review/pm-marketing/",
  import.meta.url,
).pathname;
const browser = await chromium.launch({ headless: true });
const shot = async (
  path: string,
  name: string,
  width: number,
  theme: "light" | "dark",
) => {
  const page = await browser.newPage({
    viewport: { width, height: width < 600 ? 844 : 900 },
    colorScheme: theme,
    deviceScaleFactor: width < 600 ? 2 : 1,
  });
  await page.addInitScript((value) => {
    try {
      localStorage.setItem("theme", value);
    } catch {
      /* Private mode: the page follows the colour scheme instead. */
    }
  }, theme);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(origin + path, { waitUntil: "load" });
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}${name}.png`, fullPage: true });
  await page.close();
};
const captures: [string, string, number, "light" | "dark"][] = [
  ["/en", "home-en-1440-light", 1440, "light"],
  ["/en", "home-en-1440-dark", 1440, "dark"],
  ["/pt", "home-pt-390-light", 390, "light"],
  ["/es", "home-es-390-dark", 390, "dark"],
  ["/en/features", "features-en-1440-light", 1440, "light"],
  ["/pt/features", "features-pt-390-dark", 390, "dark"],
  ["/en/pricing", "pricing-en-1440-light", 1440, "light"],
  ["/pt/pricing", "pricing-pt-1440-dark", 1440, "dark"],
  ["/pt/pricing", "pricing-pt-390-light", 390, "light"],
  ["/en/about", "about-en-1440-light", 1440, "light"],
  ["/pt/contact", "contact-pt-390-light", 390, "light"],
  ["/en/contact", "contact-en-1440-dark", 1440, "dark"],
  ["/es/privacy", "privacy-es-1440-light", 1440, "light"],
  ["/pt/abuse", "abuse-pt-390-dark", 390, "dark"],
  ["/en/missing", "notfound-en-390-light", 390, "light"],
];
const only = process.argv[2];
for (const [path, name, width, theme] of captures)
  if (!only || name.includes(only)) await shot(path, name, width, theme);

const overflow: string[] = [];
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
for (const locale of ["en", "pt", "es"])
  for (const suffix of [
    "",
    "/features",
    "/pricing",
    "/about",
    "/contact",
    "/abuse",
    "/privacy",
    "/terms",
  ]) {
    await page.goto(`${origin}/${locale}${suffix}`, { waitUntil: "load" });
    const wide = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    if (wide) overflow.push(`/${locale}${suffix}`);
  }
console.log(
  overflow.length
    ? `Overflow at 390: ${overflow.join(", ")}`
    : "No overflow at 390 px",
);
await browser.close();
