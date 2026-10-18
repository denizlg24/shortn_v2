import {
  linkRulesInputSchema,
  socialPreviewSchema,
  type LinkRulesInput,
  type SocialPreview,
} from "@shortn/core";

type AdvancedInput = {
  rules?: LinkRulesInput | null;
  og?: SocialPreview | null;
};
type ParsedAdvanced =
  | { value: AdvancedInput; error?: never; field?: never }
  | { error: "invalid_input"; field: string; value?: never };
const ruleNames = new Set([
  "activeFrom",
  "expiresAt",
  "maxClicks",
  "expiredUrl",
  "forwardQuery",
  "permanent",
  "deepLink.ios",
  "deepLink.android",
  "deepLink.fallback",
  "deepLink.store.ios",
  "deepLink.store.android",
  "geo.count",
  "device.count",
  "rotation.count",
  ...["source", "medium", "campaign", "term", "content"].map(
    (key) => `utm.${key}`,
  ),
]);
const rowFields = {
  geo: ["country", "url"],
  device: ["os", "device", "url"],
  rotation: ["url", "weight"],
} as const;

/** Explicitly UTC form dates, with a round-trip check against calendar normalization. */
function utcDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(value))
    return null;
  const normalized = `${value.length === 16 ? `${value}:00` : value}Z`;
  const parsed = new Date(normalized);
  if (!Number.isFinite(parsed.getTime())) return null;
  const canonical = parsed.toISOString();
  if (canonical.slice(0, 19) !== normalized.slice(0, 19)) return null;
  return canonical;
}

/** Omitted marker preserves existing advanced data for older/basic-only clients. */
export function parseLinkAdvancedInput(form: FormData): ParsedAdvanced {
  if (!form.has("advancedVersion")) return { value: {} };
  if (
    form.getAll("advancedVersion").length !== 1 ||
    form.get("advancedVersion") !== "1"
  )
    return { error: "invalid_input", field: "rules" };
  const values = new Map<string, string>();
  for (const [name, raw] of form) {
    if (!name.startsWith("rule.") && !name.startsWith("og.")) continue;
    if (values.has(name) || typeof raw !== "string" || raw.length > 2048)
      return {
        error: "invalid_input",
        field: name.startsWith("og.") ? "og" : "rules",
      };
    if (name.startsWith("og.")) {
      if (!["og.title", "og.description", "og.image"].includes(name))
        return { error: "invalid_input", field: "og" };
    } else {
      const key = name.slice(5),
        row = /^(geo|device|rotation)\.(\d+)\.([a-z]+)$/.exec(key);
      if (
        !ruleNames.has(key) &&
        (!row ||
          !Object.keys(rowFields).includes(row[1]!) ||
          Number(row[2]) >= 10 ||
          !rowFields[row[1] as keyof typeof rowFields].some(
            (field) => field === row[3],
          ))
      )
        return { error: "invalid_input", field: "rules" };
    }
    values.set(name, raw.trim());
  }
  const text = (key: string) => values.get(`rule.${key}`) ?? "";
  const rules: Record<string, unknown> = {};
  for (const key of ["activeFrom", "expiresAt"]) {
    if (!text(key)) continue;
    const value = utcDate(text(key));
    if (!value) return { error: "invalid_input", field: "rules" };
    rules[key] = value;
  }
  for (const key of ["forwardQuery", "permanent"]) {
    if (text(key) && text(key) !== "on")
      return { error: "invalid_input", field: "rules" };
    if (text(key)) rules[key] = true;
  }
  if (text("maxClicks")) {
    if (!/^\d+$/.test(text("maxClicks")))
      return { error: "invalid_input", field: "rules" };
    rules.maxClicks = Number(text("maxClicks"));
  }
  if (text("expiredUrl")) rules.expiredUrl = text("expiredUrl");
  for (const [kind, fields] of Object.entries(rowFields)) {
    const count = text(`${kind}.count`) || "0";
    if (!/^(?:[0-9]|10)$/.test(count))
      return { error: "invalid_input", field: "rules" };
    const rows = [];
    for (const key of values.keys()) {
      const row = new RegExp(`^rule\\.${kind}\\.(\\d+)\\.`).exec(key);
      if (row && Number(row[1]) >= Number(count))
        return { error: "invalid_input", field: "rules" };
    }
    for (let index = 0; index < Number(count); index++) {
      const row: Record<string, unknown> = {};
      for (const field of fields) {
        const value = text(`${kind}.${index}.${field}`);
        if (value)
          row[field] =
            field === "weight"
              ? Number(value)
              : field === "country"
                ? value.toUpperCase()
                : value;
      }
      rows.push(row);
    }
    if (rows.length) rules[kind] = rows;
  }
  const utm = Object.fromEntries(
    ["source", "medium", "campaign", "term", "content"].flatMap((key) =>
      text(`utm.${key}`) ? [[key, text(`utm.${key}`)]] : [],
    ),
  );
  if (Object.keys(utm).length) rules.utm = utm;
  const ios = text("deepLink.ios"),
    android = text("deepLink.android"),
    storeIos = text("deepLink.store.ios"),
    storeAndroid = text("deepLink.store.android"),
    fallback = text("deepLink.fallback") || "web";
  if (!["web", "store"].includes(fallback))
    return { error: "invalid_input", field: "rules" };
  if (ios || android || storeIos || storeAndroid || fallback === "store")
    rules.deepLink = {
      ...(ios ? { ios } : {}),
      ...(android ? { android } : {}),
      fallback,
      ...(storeIos || storeAndroid
        ? {
            store: {
              ...(storeIos ? { ios: storeIos } : {}),
              ...(storeAndroid ? { android: storeAndroid } : {}),
            },
          }
        : {}),
    };
  const parsedRules = linkRulesInputSchema.safeParse(rules);
  if (!parsedRules.success) return { error: "invalid_input", field: "rules" };
  const og = Object.fromEntries(
    ["title", "description", "image"].flatMap((key) =>
      values.get(`og.${key}`) ? [[key, values.get(`og.${key}`)!]] : [],
    ),
  );
  const parsedOg = Object.keys(og).length
    ? socialPreviewSchema.safeParse(og)
    : null;
  if (parsedOg && !parsedOg.success)
    return { error: "invalid_input", field: "og" };
  return {
    value: {
      rules: Object.keys(parsedRules.data).length ? parsedRules.data : null,
      og: parsedOg?.success ? parsedOg.data : null,
    },
  };
}
