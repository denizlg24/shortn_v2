"use server";
import { requestLinkMetadata, readLinkMetadata } from "@shortn/core";
import { serviceContext } from "../context";
import { redis } from "../redis";
export async function requestLinkMetadataAction(
  workspace: string,
  url: string,
) {
  const ctx = await serviceContext(workspace);
  const result = await requestLinkMetadata(ctx, (await redis()).durable, url);
  return result.ok ? { value: result.value } : { error: result.error };
}
export async function readLinkMetadataAction(workspace: string, id: string) {
  const result = await readLinkMetadata(await serviceContext(workspace), id);
  return result.ok ? { value: result.value } : { error: result.error };
}
