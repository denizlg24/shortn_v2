import type { Db, ObjectId } from "mongodb";
import {
  prepareQrExport,
  renderPreparedQr,
  QrPrintError,
  type QrLogo,
} from "@shortn/qr-render";
import { storedUploadKey, type ObjectStore } from "@shortn/storage";
import type { QrJobFormat } from "@shortn/core";

export interface QrArtifactDependencies {
  db: Db;
  store: ObjectStore;
  linkDomain: string;
  logoOrigins: string[];
}
export async function ensureQrArtifact(
  deps: QrArtifactDependencies,
  snapshot: {
    workspaceId: ObjectId;
    design: Record<string, unknown>;
    data: string;
    format: QrJobFormat;
    size: number;
  },
  authorized: () => Promise<boolean>,
) {
  if (!(await authorized())) throw new Error("access_removed");
  let logo: QrLogo | undefined;
  if (typeof snapshot.design.image === "string" && snapshot.design.image) {
    const key = storedUploadKey(snapshot.design.image, deps.logoOrigins);
    if (!key) throw new QrPrintError("logo_unavailable");
    const png = await deps.store.get(key, 5 * 1024 * 1024);
    if (
      png.length < 24 ||
      Buffer.from(png.subarray(0, 8)).toString("hex") !== "89504e470d0a1a0a"
    )
      throw new QrPrintError("logo_unavailable");
    logo = {
      png,
      width: Buffer.from(png).readUInt32BE(16),
      height: Buffer.from(png).readUInt32BE(20),
    };
  }
  const prepared = prepareQrExport(
    snapshot.design,
    snapshot.data,
    snapshot.format,
    snapshot.size,
    logo,
  );
  const objectKey = `exports/qr/${snapshot.workspaceId}/${prepared.designHash}.${snapshot.format}`;
  let cached = await deps.store.head(objectKey);
  if (
    !cached ||
    cached.contentType !== prepared.contentType ||
    cached.bytes <= 0
  ) {
    const rendered = await renderPreparedQr(prepared);
    if (!(await authorized())) throw new Error("access_removed");
    await deps.store.put(objectKey, rendered.bytes, rendered.contentType);
    cached = {
      bytes: rendered.bytes.length,
      contentType: rendered.contentType,
    };
  }
  if (!(await authorized())) throw new Error("access_removed");
  return {
    objectKey,
    bytes: cached.bytes,
    contentType: cached.contentType,
    print: {
      minimumMm: prepared.plan.minimumPrintMm,
      quietModules: prepared.plan.quietZoneModules,
      correction: prepared.plan.correction,
    },
  };
}
