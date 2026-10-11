import "server-only";
import { getQr, type QrView } from "@shortn/core";
import { notFound } from "next/navigation";
import { cache } from "react";
import { serviceContext } from "./context";

// One lookup per request for the QR pages and their metadata.
export const loadQr = cache(async (workspace: string, id: string) => {
  const ctx = await serviceContext(workspace);
  const qr = await getQr(ctx, id);
  if (!qr) notFound();
  return { ctx, qr };
});

export const qrName = (qr: Pick<QrView, "title" | "key">) => qr.title || qr.key;

export type QrTab = "overview" | "design" | "analytics" | "edit";

// Viewers get the read-only tabs only.
export const qrTabs = (
  workspace: string,
  id: string,
  editable: boolean,
  label: (key: QrTab) => string,
) => {
  const base = `/${workspace}/qr/${id}`;
  return [
    { label: label("overview"), href: base },
    ...(editable ? [{ label: label("design"), href: `${base}/design` }] : []),
    { label: label("analytics"), href: `${base}/analytics` },
    ...(editable ? [{ label: label("edit"), href: `${base}/edit` }] : []),
  ];
};
