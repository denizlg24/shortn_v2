"use server";

import {
  queryAnalytics,
  analyticsQueryInput,
  type AnalyticsResult,
} from "@shortn/core";
import type { z } from "zod";
import { serviceContext } from "../context";
import type { ActionResult } from "./result";

export type { AnalyticsResult } from "@shortn/core";

export async function analyticsAction(
  workspace: string,
  input: z.input<typeof analyticsQueryInput>,
): Promise<ActionResult<AnalyticsResult>> {
  const result = await queryAnalytics(await serviceContext(workspace), input);
  return result.ok ? { ok: true, data: result.value } : result;
}
