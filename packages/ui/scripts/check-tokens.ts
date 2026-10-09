import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  MIN_SERIES_DELTA,
  runTokenChecks,
  type CheckSection,
} from "./token-checks";

const source = readFileSync(
  fileURLToPath(new URL("../src/tokens.css", import.meta.url)),
  "utf8",
);

const SECTION_HEADING: Record<Exclude<CheckSection, "gamut">, string> = {
  text: "text (AA 4.5:1)",
  "non-text": "non-text (AA 3:1)",
  series: `chart series, closest pair in OKLab under simulated vision (min ${MIN_SERIES_DELTA})`,
};

const results = runTokenChecks(source);
let theme: string | null = null;
let section: CheckSection | null = null;

for (const result of results) {
  if (result.theme !== theme) {
    theme = result.theme;
    section = null;
    console.log(`\n${result.theme.toUpperCase()}`);
  }
  const status = result.pass ? "pass" : "FAIL";
  if (result.section === "gamut") {
    if (!result.pass) console.log(`    ${status}  ${result.detail}`);
    continue;
  }
  if (result.section !== section) {
    section = result.section;
    console.log(`  ${SECTION_HEADING[result.section]}`);
  }
  const name = result.name.padEnd(result.section === "series" ? 13 : 30);
  console.log(`    ${status}  ${name} ${result.detail}`);
}

const failures = results.filter((result) => !result.pass).length;
console.log(
  failures === 0
    ? "\nAll token checks pass."
    : `\n${failures} token check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);
