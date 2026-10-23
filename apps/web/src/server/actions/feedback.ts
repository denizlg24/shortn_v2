"use server";

import { submitFeedback } from "@shortn/core";
import { feedbackCategories } from "@shortn/db";
import { getLocale } from "next-intl/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { serviceContext } from "../context";
import { text } from "../form-data";
import type { FormState } from "./link-pages";

type Category = (typeof feedbackCategories)[number];
const isCategory = (value: string): value is Category =>
  (feedbackCategories as readonly string[]).includes(value);

export async function submitFeedbackPageAction(
  workspace: string,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const category = text(form, "category");
  const message = text(form, "message");
  if (!isCategory(category))
    return { error: "invalid_input", field: "category" };
  if (!message) return { error: "message_required", field: "message" };
  const page = text(form, "page");
  const result = await submitFeedback(await serviceContext(workspace), {
    category,
    message,
    ...(page.startsWith("/") && !page.startsWith("//")
      ? { page: page.slice(0, 500) }
      : {}),
    locale: await getLocale(),
    userAgent: (await headers()).get("user-agent") ?? undefined,
  });
  if (!result.ok)
    return {
      error: result.error,
      ...(result.error === "invalid_input" ? { field: "message" } : {}),
    };
  redirect(`/${workspace}/feedback?sent=${result.value.id}`);
}
