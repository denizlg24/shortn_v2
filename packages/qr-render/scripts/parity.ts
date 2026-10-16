import { strict as assert } from "node:assert";
import { mkdir, writeFile, mkdtemp, rm } from "node:fs/promises";
import { chromium } from "playwright-core";
import { PNG } from "pngjs";
import type { Options } from "qr-code-styling";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderQrExport, type QrLogo } from "../index";

const url = "https://shortn.at/parity?qr=synthetic";
const styles = [
  "square",
  "dots",
  "rounded",
  "extra-rounded",
  "classy",
  "classy-rounded",
];
const cases: {
  name: string;
  stored: Record<string, unknown>;
  logo?: QrLogo;
}[] = styles.flatMap((dot) =>
  styles.map((corner) => ({
    name: `${dot}-${corner}`,
    stored: {
      dotsOptions: { type: dot, color: "#000000" },
      cornersSquareOptions: { type: corner },
      cornersDotOptions: { type: corner },
    },
  })),
);
cases.push({
  name: "fractional-modules",
  stored: { dotsOptions: { type: "rounded", roundSize: false } },
});
cases.push({
  name: "linear-gradient",
  stored: {
    dotsOptions: {
      type: "extra-rounded",
      gradient: {
        type: "linear",
        rotation: Math.PI / 3,
        colorStops: [
          { offset: 0, color: "#000000" },
          { offset: 1, color: "#000080" },
        ],
      },
    },
  },
});
cases.push({
  name: "radial-gradient",
  stored: {
    dotsOptions: {
      type: "classy-rounded",
      gradient: {
        type: "radial",
        colorStops: [
          { offset: 0, color: "#000000" },
          { offset: 1, color: "#000080" },
        ],
      },
    },
  },
});
for (const shape of ["square", "circle"])
  for (const style of ["none", "outline", "solid"])
    for (const caption of ["", "São João — escanea aquí"])
      cases.push({
        name: `${shape}-${style}-${caption ? "caption" : "plain"}`,
        stored: {
          shape,
          frameOptions: { style, caption },
          dotsOptions: { type: "rounded", color: "navy" },
        },
      });
cases.push({
  name: "caption-64-wide",
  stored: { frameOptions: { style: "outline", caption: "W".repeat(64) } },
});
cases.push({
  name: "native-dot-finders",
  stored: {
    cornersSquareOptions: { type: "dot" },
    cornersDotOptions: { type: "dot" },
  },
});
for (const height of [32, 64]) {
  const png = new PNG({ width: 64, height });
  for (let index = 0; index < png.data.length; index += 4) {
    png.data[index] = 30;
    png.data[index + 1] = 90;
    png.data[index + 2] = 255;
    png.data[index + 3] = 255;
  }
  const bytes = PNG.sync.write(png);
  cases.push({
    name: `circle-logo-${height}`,
    stored: {
      shape: "circle",
      frameOptions: { style: "outline", caption: "Synthetic café" },
      image: `data:image/png;base64,${bytes.toString("base64")}`,
      imageOptions: { crossOrigin: "anonymous", margin: 0 },
      dotsOptions: { type: "rounded", color: "navy" },
    },
    logo: { png: new Uint8Array(bytes), width: 64, height },
  });
}
const temp = await mkdtemp(join(tmpdir(), "shortn-qr-parity-"));
await writeFile(
  join(temp, "entry.ts"),
  `import { renderQrBlob } from ${JSON.stringify(new URL("../../../apps/web/src/components/qr/qr-render.ts", import.meta.url).pathname)}; globalThis.shortnQrBlob = renderQrBlob;`,
);
const bundle = await Bun.build({
  entrypoints: [join(temp, "entry.ts")],
  target: "browser",
  format: "esm",
  outdir: temp,
});
if (!bundle.success) throw new Error(bundle.logs.map(String).join("\n"));
const browser = await chromium.launch({ headless: true });
const directory = new URL(
  "../../../.impeccable/review/p6-qr-export",
  import.meta.url,
).pathname;
await mkdir(directory, { recursive: true });
try {
  const page = await browser.newPage();
  await page.setContent(
    "<!doctype html><title>Synthetic QR parity fixture</title>",
  );
  await page.addScriptTag({ type: "module", path: bundle.outputs[0]!.path });
  await page.waitForFunction(() => "shortnQrBlob" in globalThis);
  const report: object[] = [];
  for (const { name, stored, logo } of cases) {
    const options = {
      ...stored,
      type: "svg",
      width: 1024,
      height: 1024,
      data: url,
    } as Options;
    const client = await page.evaluate(async (serialized) => {
      const options = JSON.parse(serialized) as Options;
      const render = (
        globalThis as unknown as {
          shortnQrBlob: (options: Options, format: "png") => Promise<Blob>;
        }
      ).shortnQrBlob;
      const blob = await render(options, "png");
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    }, JSON.stringify(options));
    const server = await renderQrExport(stored, url, "png", 1024, logo);
    const a = PNG.sync.read(Buffer.from(server.bytes)),
      b = PNG.sync.read(Buffer.from(client));
    assert.equal(a.width, 1024);
    assert.equal(b.width, 1024);
    let changed = 0;
    for (let pixel = 0; pixel < a.data.length; pixel += 4) {
      if (
        [0, 1, 2, 3].some(
          (channel) =>
            Math.abs(a.data[pixel + channel]! - b.data[pixel + channel]!) > 16,
        )
      )
        changed++;
    }
    const fraction = changed / (1024 * 1024);
    report.push({
      name,
      changedPixels: changed,
      difference: fraction,
      size: 1024,
    });
    if (fraction >= 0.01) {
      await writeFile(`${directory}/${name}-server.png`, server.bytes);
      await writeFile(`${directory}/${name}-client.png`, Buffer.from(client));
    }
    assert(
      fraction < 0.01,
      `${name}: ${(fraction * 100).toFixed(3)}% changed pixels`,
    );
  }
  await writeFile(`${directory}/parity.json`, JSON.stringify(report, null, 2));
  console.log(
    `${report.length} synthetic browser/server QR comparisons passed below 1% at 1024 px`,
  );
} finally {
  await browser.close();
  await rm(temp, { recursive: true, force: true });
}
