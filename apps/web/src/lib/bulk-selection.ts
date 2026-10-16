// 500 ObjectIds use 8,000 URL-safe characters, staying below an 8 KiB request
// target with the workspace route. Repeated ?ids= parameters exceed that size.
export const bulkSelectionLimit = 500;
export function normalizeSelection(values: unknown): string[] {
  return Array.isArray(values)
    ? [
        ...new Set(
          values
            .filter(
              (value): value is string =>
                typeof value === "string" && /^[a-f\d]{24}$/i.test(value),
            )
            .map((value) => value.toLowerCase()),
        ),
      ].slice(0, bulkSelectionLimit)
    : [];
}
export function encodeSelection(ids: string[]): string {
  if (ids.length > bulkSelectionLimit)
    throw new Error("Selection exceeds limit");
  const normalized = normalizeSelection(ids);
  if (normalized.length !== ids.length)
    throw new Error("Invalid selection IDs");
  const binary = normalized
    .map((id) =>
      id
        .match(/../g)!
        .map((byte) => String.fromCharCode(parseInt(byte, 16)))
        .join(""),
    )
    .join("");
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_");
}
export function decodeSelection(value: unknown): string[] {
  if (
    typeof value !== "string" ||
    !value.length ||
    value.length > bulkSelectionLimit * 16 ||
    value.length % 16 ||
    !/^[a-z\d_-]+$/i.test(value)
  )
    return [];
  try {
    const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/"));
    return normalizeSelection(
      Array.from({ length: binary.length / 12 }, (_, index) =>
        [...binary.slice(index * 12, index * 12 + 12)]
          .map((char) => char.charCodeAt(0).toString(16).padStart(2, "0"))
          .join(""),
      ),
    );
  } catch {
    return [];
  }
}
