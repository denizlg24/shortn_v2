import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright-core";

const root = fileURLToPath(new URL("..", import.meta.url));
const outDir = fileURLToPath(new URL("../.review/", import.meta.url));
const port = 5179;
const base = `http://localhost:${port}`;

type Theme = "light" | "dark";
type Lang = "en" | "pt";

interface Shot {
  name: string;
  width: number;
  height: number;
  theme: Theme;
  lang: Lang;
  hash?: string;
  act?: (page: Page) => Promise<void>;
  fullPage?: boolean;
}

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

const openFirstRow = async (page: Page) => {
  await page
    .locator('[role="row"][data-row-index="2"]')
    .click({ position: { x: 700, y: 20 } });
  await page.getByRole("dialog").waitFor();
  await page.waitForTimeout(400);
};

const shots: Shot[] = [
  ...(["light", "dark"] as const).flatMap((theme) =>
    (["en", "pt"] as const).flatMap((lang): Shot[] => [
      { name: `desktop-${theme}-${lang}`, ...DESKTOP, theme, lang },
      { name: `mobile-${theme}-${lang}`, ...MOBILE, theme, lang },
    ]),
  ),
  {
    name: "desktop-light-en-sheet",
    ...DESKTOP,
    theme: "light",
    lang: "en",
    act: openFirstRow,
  },
  {
    name: "desktop-dark-pt-sheet",
    ...DESKTOP,
    theme: "dark",
    lang: "pt",
    act: openFirstRow,
  },
  {
    name: "desktop-light-pt-composer",
    ...DESKTOP,
    theme: "light",
    lang: "pt",
    act: async (page) => {
      await page.evaluate(() => {
        const data = new DataTransfer();
        data.setData(
          "text/plain",
          "https://gazetaexemplo.pt/fiscalidade/irs-jovem-quem-beneficia-e-como-pedir?utm_source=newsletter",
        );
        document.dispatchEvent(
          new ClipboardEvent("paste", { clipboardData: data, bubbles: true }),
        );
      });
      await page.waitForTimeout(250);
    },
  },
  {
    name: "desktop-light-en-created",
    ...DESKTOP,
    theme: "light",
    lang: "en",
    act: async (page) => {
      await page.evaluate(() => {
        const data = new DataTransfer();
        data.setData(
          "text/plain",
          "https://gazetaexemplo.pt/economia/salario-minimo-2027-o-que-muda",
        );
        document.dispatchEvent(
          new ClipboardEvent("paste", { clipboardData: data, bubbles: true }),
        );
      });
      await page.keyboard.press("Enter");
      await page.waitForTimeout(500);
    },
  },
  {
    name: "desktop-light-en-bulk",
    ...DESKTOP,
    theme: "light",
    lang: "en",
    act: async (page) => {
      await page.keyboard.press("j");
      await page.keyboard.press("x");
      await page.keyboard.press("j");
      await page.keyboard.press("j");
      await page.keyboard.press("Shift+X");
      await page.waitForTimeout(250);
    },
  },
  {
    name: "desktop-dark-en-palette",
    ...DESKTOP,
    theme: "dark",
    lang: "en",
    act: async (page) => {
      await page.keyboard.press("j");
      await page.keyboard.press("ControlOrMeta+k");
      await page.getByRole("dialog").waitFor();
      await page.waitForTimeout(300);
    },
  },
  {
    name: "desktop-light-en-empty",
    ...DESKTOP,
    theme: "light",
    lang: "en",
    hash: "#/links?state=empty",
  },
  {
    name: "desktop-light-en-loading",
    ...DESKTOP,
    theme: "light",
    lang: "en",
    hash: "#/links?state=loading",
  },
  {
    name: "desktop-dark-pt-error",
    ...DESKTOP,
    theme: "dark",
    lang: "pt",
    hash: "#/links?state=error",
  },
  {
    name: "desktop-light-pt-readonly",
    ...DESKTOP,
    theme: "light",
    lang: "pt",
    hash: "#/links?state=readonly",
    act: async (page) => {
      await page.getByRole("button", { name: "Criar link" }).first().hover();
      await page.waitForTimeout(800);
    },
  },
  {
    name: "desktop-light-en-long",
    ...DESKTOP,
    theme: "light",
    lang: "en",
    hash: "#/links?state=long",
  },
  {
    name: "rail-light-pt",
    width: 1100,
    height: 800,
    theme: "light",
    lang: "pt",
  },
  {
    name: "mobile-light-en-sheet",
    ...MOBILE,
    theme: "light",
    lang: "en",
    act: async (page) => {
      await page.locator('[role="row"][data-row-index="1"]').click();
      await page.getByRole("dialog").waitFor();
      await page.waitForTimeout(400);
    },
  },
  {
    name: "gallery-light-en",
    ...DESKTOP,
    theme: "light",
    lang: "en",
    hash: "#/gallery",
    fullPage: true,
  },
  {
    name: "gallery-dark-en",
    ...DESKTOP,
    theme: "dark",
    lang: "en",
    hash: "#/gallery",
    fullPage: true,
  },
];

function findChromium(): { executablePath?: string; channel?: string } {
  const fromEnv = process.env.CHROMIUM_PATH;
  if (fromEnv) return { executablePath: fromEnv };
  const cached = `${homedir()}/Library/Caches/ms-playwright/chromium-1246/chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium`;
  if (existsSync(cached)) return { executablePath: cached };
  return { channel: "chrome" };
}

async function waitForServer(url: string, attempts = 60): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`Preview server did not start at ${url}`);
}

async function capture(browser: Browser, shot: Shot) {
  const context = await browser.newContext({
    viewport: { width: shot.width, height: shot.height },
    deviceScaleFactor: 2,
    colorScheme: shot.theme,
    reducedMotion: "reduce",
    locale: shot.lang === "pt" ? "pt-PT" : "en-GB",
    isMobile: shot.width < 768,
    hasTouch: shot.width < 768,
  });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: base,
  });
  const page = await context.newPage();
  await page.goto(
    `${base}/?theme=${shot.theme}&lang=${shot.lang}${shot.hash ?? "#/links"}`,
  );
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
  await shot.act?.(page);
  if (shot.fullPage) {
    const contentHeight = await page.evaluate(() => {
      const scroller = document.querySelector("main .overflow-y-auto");
      const header = document.querySelector("main header");
      return (
        (scroller?.scrollHeight ?? 0) +
        (header?.getBoundingClientRect().height ?? 0)
      );
    });
    await page.setViewportSize({
      width: shot.width,
      height: Math.max(shot.height, Math.ceil(contentHeight)),
    });
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: `${outDir}${shot.name}.png` });
  await context.close();
  console.log(`captured ${shot.name}`);
}

mkdirSync(outDir, { recursive: true });
const server = spawn(
  "bunx",
  [
    "vite",
    "preview",
    "--config",
    "playground/vite.config.ts",
    "--port",
    String(port),
    "--strictPort",
  ],
  {
    cwd: root,
    stdio: "ignore",
  },
);

try {
  await waitForServer(base);
  const browser = await chromium.launch(findChromium());
  const only = process.argv.slice(2);
  for (const shot of shots.filter(
    (candidate) =>
      only.length === 0 || only.some((name) => candidate.name.includes(name)),
  )) {
    await capture(browser, shot);
  }
  await browser.close();
} finally {
  server.kill();
}
