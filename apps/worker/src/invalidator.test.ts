import { expect, test } from "bun:test";
import { physicalNames } from "@shortn/db";
import type {
  ChangeStreamDeleteDocument,
  ChangeStreamInsertDocument,
  ChangeStreamUpdateDocument,
} from "mongodb";
import { Binary, ObjectId } from "mongodb";
import { planInvalidation } from "./invalidator";

const ns = (coll: string) => ({ db: "shortn", coll });
const base = {
  _id: { _data: "x" },
  documentKey: { _id: new ObjectId() },
  collectionUUID: new Binary(),
};

test("renames invalidate both the old and the new code, aliases included", () => {
  const change: ChangeStreamUpdateDocument = {
    ...base,
    operationType: "update",
    ns: ns(physicalNames.links),
    updateDescription: { updatedFields: { urlCode: "new" } },
    fullDocumentBeforeChange: {
      urlCode: "old",
      key: "old",
      previousKeys: ["older"],
    },
    fullDocument: { urlCode: "new", key: "old" },
  };
  expect(planInvalidation(change)).toEqual({
    type: "keys",
    keys: ["old", "older", "new"],
  });
});

test("QR changes invalidate the backing link's code", () => {
  const change: ChangeStreamInsertDocument = {
    ...base,
    operationType: "insert",
    ns: ns(physicalNames.qr_codes),
    fullDocument: { urlId: "abc", qrCodeId: "Q" },
  };
  expect(planInvalidation(change)).toEqual({ type: "keys", keys: ["abc"] });
});

test("deletes without a pre-image flush everything; other collections are ignored", () => {
  const deleted: ChangeStreamDeleteDocument = {
    ...base,
    operationType: "delete",
    ns: ns(physicalNames.links),
  };
  expect(planInvalidation(deleted)).toEqual({ type: "flush" });
  const unrelated: ChangeStreamInsertDocument = {
    ...base,
    operationType: "insert",
    ns: ns(physicalNames.clicks),
    fullDocument: { urlCode: "x" },
  };
  expect(planInvalidation(unrelated)).toEqual({ type: "none" });
});
