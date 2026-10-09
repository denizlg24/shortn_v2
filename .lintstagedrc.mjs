import path from "node:path";
const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
export default (files) => {
  const editable = files.filter((file) => {
    const relative = path.relative(import.meta.dirname, file);
    return relative !== "PRODUCT.md" && !relative.startsWith("docs/");
  });
  const source = editable.filter((file) => /\.[cm]?[jt]sx?$/.test(file));
  const legacy = source.filter((file) =>
    path.relative(import.meta.dirname, file).startsWith("legacy/"),
  );
  const foundation = source.filter((file) => !legacy.includes(file));
  const formatted = editable.filter((file) =>
    /\.(?:[cm]?[jt]sx?|json|md|ya?ml)$/.test(file),
  );
  return [
    ...(legacy.length
      ? [
          `eslint --config legacy/eslint.config.mjs --fix ${legacy.map(quote).join(" ")}`,
        ]
      : []),
    ...(foundation.length
      ? [`eslint --fix ${foundation.map(quote).join(" ")}`]
      : []),
    ...(formatted.length
      ? [`prettier --write ${formatted.map(quote).join(" ")}`]
      : []),
  ];
};
