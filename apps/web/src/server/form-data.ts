import "server-only";

// Reading native form posts in the section form actions.

export const text = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
};

// Tags arrive as repeated fields; older forms may also post comma-separated newTags.
export const tagsFrom = (form: FormData) =>
  [
    ...new Set(
      [
        ...form
          .getAll("tag")
          .filter((value): value is string => typeof value === "string"),
        ...text(form, "newTags").split(","),
      ]
        .map((tag) => tag.trim().slice(0, 48))
        .filter(Boolean),
    ),
  ].slice(0, 50);

// Editors with client state post it as one JSON field.
export const jsonFrom = (form: FormData, name: string): unknown => {
  const raw = form.get(name);
  if (typeof raw !== "string" || raw.length > 200_000) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed;
  } catch {
    return undefined;
  }
};

export const objectIds = (values: unknown[]) =>
  values
    .filter(
      (value): value is string =>
        typeof value === "string" && /^[a-f0-9]{24}$/.test(value),
    )
    .slice(0, 500);
