import "server-only";
import {
  BSON,
  ObjectId,
  type Collection,
  type Document,
  type Filter,
  type WithId,
} from "mongodb";

export const pageSize = 50;
export const countCap = 10_000;

export type SearchParams = Record<string, string | string[] | undefined>;

export const param = (params: SearchParams, name: string) => {
  const value = params[name];
  const first = Array.isArray(value) ? value[0] : value;
  return first?.trim() ? first.trim() : undefined;
};

export const params = (params: SearchParams, name: string) => {
  const value = params[name];
  return (Array.isArray(value) ? value : value ? [value] : []).filter(Boolean);
};

/** The first value of `name` if it's one of `allowed`. */
export const choice = <T extends string>(
  search: SearchParams,
  name: string,
  allowed: readonly T[],
): T | undefined => allowed.find((item) => item === param(search, name));

export const objectIdOrNull = (value: string | undefined) =>
  value && /^[a-f\d]{24}$/i.test(value) ? new ObjectId(value) : null;

/** Escapes user input for an anchored prefix regex (index-backed). */
export const prefixRegex = (value: string) =>
  new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);

interface Cursor {
  v?: unknown;
  id: ObjectId;
}

const encode = (cursor: Cursor) =>
  Buffer.from(BSON.EJSON.stringify(cursor)).toString("base64url");

function decode(raw: string | undefined): Cursor | null {
  if (!raw || raw.length > 512) return null;
  try {
    const value: unknown = BSON.EJSON.parse(
      Buffer.from(raw, "base64url").toString(),
    );
    if (
      typeof value === "object" &&
      value !== null &&
      "id" in value &&
      value.id instanceof ObjectId
    )
      return { id: value.id, ...("v" in value ? { v: value.v } : {}) };
  } catch {
    // A tampered cursor is just page one.
  }
  return null;
}

export interface KeysetPage<T> {
  rows: T[];
  /** Cursor for the next page (older rows in the sort), if any. */
  next?: string;
  /** Cursor for the previous page, if not on the first. */
  prev?: string;
}

/**
 * Keyset pagination on `(field, _id)` (23 §2.0): stable under inserts, and
 * every page is an index range scan when `field` leads a compound index
 * with `_id`. `after`/`before` come from the URL as opaque cursors.
 */
export async function keysetPage<T extends Document>(
  collection: Collection<T>,
  filter: Filter<T>,
  options: {
    after?: string | undefined;
    before?: string | undefined;
    field?: string;
    order?: 1 | -1;
    projection?: Document;
    limit?: number;
  } = {},
): Promise<KeysetPage<WithId<T>>> {
  const field = options.field ?? "_id";
  const order = options.order ?? -1;
  const limit = options.limit ?? pageSize;
  const before = decode(options.before);
  const after = before ? null : decode(options.after);
  const cursor = before ?? after;
  // Walking backwards flips the comparison and the sort, then the rows.
  const direction = before ? -order : order;
  const op = direction === -1 ? "$lt" : "$gt";
  const range: Document | null = cursor
    ? field === "_id"
      ? { _id: { [op]: cursor.id } }
      : {
          $or: [
            { [field]: { [op]: cursor.v } },
            { [field]: cursor.v, _id: { [op]: cursor.id } },
          ],
        }
    : null;
  const query: Document = range ? { $and: [filter, range] } : filter;
  const sort: Record<string, 1 | -1> =
    field === "_id"
      ? { _id: direction === 1 ? 1 : -1 }
      : { [field]: direction === 1 ? 1 : -1, _id: direction === 1 ? 1 : -1 };
  const found = await collection
    .find(query as Filter<T>, {
      sort,
      limit: limit + 1,
      ...(options.projection ? { projection: options.projection } : {}),
    })
    .toArray();
  const more = found.length > limit;
  const rows = found.slice(0, limit);
  if (before) rows.reverse();
  const cursorOf = (row: WithId<T>) =>
    encode({
      id: row._id,
      ...(field === "_id"
        ? {}
        : {
            v: field
              .split(".")
              .reduce<unknown>(
                (value, key) =>
                  typeof value === "object" && value !== null
                    ? Reflect.get(value, key)
                    : undefined,
                row,
              ),
          }),
    });
  const first = rows[0];
  const last = rows.at(-1);
  const hasNext = before ? true : more;
  const hasPrev = before ? more : Boolean(after);
  return {
    rows,
    ...(hasNext && last ? { next: cursorOf(last) } : {}),
    ...(hasPrev && first ? { prev: cursorOf(first) } : {}),
  };
}

export interface BoundedCount {
  value: number;
  capped: boolean;
}

/** 23 §2.0: an exact count up to 10,000, the estimate when unfiltered. */
export async function boundedCount<T extends Document>(
  collection: Collection<T>,
  filter: Filter<T>,
): Promise<BoundedCount> {
  if (Object.keys(filter).length === 0)
    return { value: await collection.estimatedDocumentCount(), capped: false };
  const value = await collection.countDocuments(filter, {
    limit: countCap + 1,
  });
  return { value: Math.min(value, countCap), capped: value > countCap };
}

/** Batch-loads documents by id for one page of rows. */
export async function byIds<T extends Document>(
  collection: Collection<T>,
  ids: (ObjectId | string | null | undefined)[],
  projection?: Document,
): Promise<Map<string, WithId<T>>> {
  const unique = [
    ...new Set(
      ids
        .map((id) => (typeof id === "string" ? id : id?.toHexString()))
        .filter((id): id is string => Boolean(id && /^[a-f\d]{24}$/i.test(id))),
    ),
  ];
  if (!unique.length) return new Map();
  const found = await collection
    .find(
      { _id: { $in: unique.map((id) => new ObjectId(id)) } } as Filter<T>,
      projection ? { projection } : {},
    )
    .toArray();
  return new Map(found.map((row) => [String(row._id), row]));
}
