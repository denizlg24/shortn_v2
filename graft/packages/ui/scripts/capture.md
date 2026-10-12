# packages/ui/scripts/capture.ts

- Theme · type · L12-L12 — type Theme = "light" | "dark";
- Lang · type · L13-L13 — type Lang = "en" | "pt";
- Shot · interface · L15-L24 — interface Shot
- openFirstRow · function · L29-L35 — openFirstRow = async (page: Page)
- findChromium · function · L198-L204 — function findChromium(): { executablePath?: string; channel?: string }
- waitForServer · function · L206-L216 — async function waitForServer(url: string, attempts = 60): Promise<void>
- capture · function · L218-L256 — async function capture(browser: Browser, shot: Shot)
