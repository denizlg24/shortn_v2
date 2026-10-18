import { publicRequestDomain } from "@/server/public-domain";
import { env as publicEnv } from "@/server/env";
import { keyPattern, publicLink } from "@shortn/core";
import { buttonVariants, cn, Label } from "@shortn/ui";
import { CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { PasswordInput } from "@/components/auth/password-input";
import {
  PublicFrame,
  PublicHeading,
  PublicMessage,
} from "@/components/public/public-frame";
import { db } from "@/server/db";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.authenticate");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

const fieldErrors = ["wrong_password", "missing"] as const;
const formErrors = ["rate_limited"] as const;
type FieldError = (typeof fieldErrors)[number];
type FormError = (typeof formErrors)[number];

const isFieldError = (value: unknown): value is FieldError =>
  fieldErrors.some((error) => error === value);
const isFormError = (value: unknown): value is FormError =>
  formErrors.some((error) => error === value);

// A plain HTML form posting to the verify route: this page is proxied onto
// shortn.at, where a server action's origin check would fail, and it must
// work without JavaScript.
export default async function AuthenticatePage({
  params,
  searchParams,
}: PageProps<"/authenticate/[key]">) {
  const [{ key }, { error }, locale, t, tCommon] = await Promise.all([
    params,
    searchParams,
    getLocale(),
    getTranslations("public"),
    getTranslations("common"),
  ]);
  const home = { href: `https://shortn.at/${locale}`, label: t("goHome") };
  const link = keyPattern.test(key)
    ? await publicLink(
        await db(),
        key,
        await publicRequestDomain(),
        publicEnv().LINK_DOMAIN,
      )
    : null;

  const content = (() => {
    if (!link || error === "not_found")
      return (
        <PublicMessage
          title={t("linkNotFound.title")}
          description={t("linkNotFound.body")}
          action={home}
        />
      );
    if (link.blocked)
      return (
        <PublicMessage
          title={t("blocked.title")}
          description={t("blocked.body")}
          action={home}
        />
      );
    if (!link.passwordProtected || error === "not_protected")
      return (
        <PublicMessage
          title={t("authenticate.notProtected.title")}
          description={t("authenticate.notProtected.body")}
          action={{
            href: `/${encodeURIComponent(key)}`,
            label: t("authenticate.notProtected.action"),
          }}
        />
      );

    const fieldError = isFieldError(error) ? error : null;
    const formError = isFormError(error) ? error : null;
    const errorId = "password-error";
    const hintId = "password-hint";
    return (
      <>
        <PublicHeading
          title={t("authenticate.title")}
          description={t("authenticate.body")}
        />
        <form
          method="post"
          action={`/authenticate/${encodeURIComponent(key)}/verify`}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">{t("authenticate.password")}</Label>
            <PasswordInput
              id="password"
              name="password"
              size="lg"
              required
              maxLength={256}
              autoFocus
              autoComplete="off"
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={
                [fieldError ? errorId : null, link.passwordHint ? hintId : null]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
            />
            {fieldError ? (
              <p id={errorId} className="text-meta text-danger">
                {fieldError === "wrong_password"
                  ? t("authenticate.errors.wrongPassword")
                  : t("authenticate.errors.missing")}
              </p>
            ) : null}
            {link.passwordHint ? (
              <p id={hintId} className="text-meta text-pretty text-fg-muted">
                {t("authenticate.hint", { hint: link.passwordHint })}
              </p>
            ) : null}
          </div>
          {formError ? (
            <p role="alert" className="flex gap-2 text-small text-danger">
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              {t("authenticate.errors.rateLimited")}
            </p>
          ) : null}
          <button
            type="submit"
            className={cn(
              buttonVariants({ variant: "primary", size: "lg" }),
              "w-full",
            )}
          >
            {t("authenticate.submit")}
          </button>
        </form>
      </>
    );
  })();

  return (
    <PublicFrame locale={locale} brand={tCommon("brand")}>
      {content}
    </PublicFrame>
  );
}
