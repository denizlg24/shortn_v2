/** Regenerate the lazy caption asset and lightweight validation cmap. */
import { readFile, writeFile } from "node:fs/promises";
import { parse } from "opentype.js";
const directory = new URL("../fonts/", import.meta.url);
const bytes = await readFile(new URL("Geist-Regular.ttf", directory));
const font = parse(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
);
const supported = new Set<number>();
for (let index = 0; index < font.glyphs.length; index++)
  for (const value of font.glyphs.get(index).unicodes) supported.add(value);
await writeFile(
  new URL("font.json", directory),
  JSON.stringify(bytes.toString("base64")) + "\n",
);
await writeFile(
  new URL("supported.json", directory),
  JSON.stringify([...supported].sort((a, b) => a - b)) + "\n",
);
