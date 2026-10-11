// Quotes every field and defuses spreadsheet formulas (=, +, -, @), as the
// raw-event export in app/api/export does.
const cell = (value: string | number) => {
  const text = String(value);
  const safe =
    typeof value === "string" && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};

export const toCsv = (rows: (string | number)[][]) =>
  rows.map((row) => row.map(cell).join(",")).join("\n") + "\n";

/** Saves text as a file from the browser. */
export function downloadText(text: string, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
