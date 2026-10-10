"use client";

import { Button, Input } from "@shortn/ui";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { createBioPageAction } from "@/server/actions/bio";
import { AuthField } from "../auth/auth-field";
import { ErrorText, settle, type ActionError } from "../editor/action-error";
import { FormPage } from "../editor/form-page";
import { GateNote, UpgradeLink } from "../plan-gate";
import { useBioError, type BioField } from "./bio-errors";
import { isBioSlug, normalizeSlug, slugMaxLength } from "./bio-rules";

/** bio/new: the handle and a title; everything else happens in the editor. */
export function BioCreateForm({
  workspace,
  host,
  used,
  limit,
}: {
  workspace: string;
  /** Public host the slug sits under, e.g. shortn.at. */
  host: string;
  used: number;
  limit: number | null;
}) {
  const t = useTranslations("bio");
  const router = useRouter();
  const toError = useBioError();
  const id = useId();
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ActionError<BioField> | null>(null);
  const atLimit = limit !== null && used >= limit;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    if (!isBioSlug(slug)) {
      setError({ field: "slug", message: t("errors.invalidSlug") });
      return;
    }
    setPending(true);
    setError(null);
    const result = await settle(
      createBioPageAction(workspace, {
        slug,
        ...(title.trim() ? { title: title.trim() } : {}),
      }),
    );
    if (!result.ok) {
      setPending(false);
      setError(toError(result));
      return;
    }
    router.push(`/${workspace}/bio/${result.data.id}`);
  };

  return (
    <FormPage
      trail={[{ href: `/${workspace}/bio`, label: t("title") }]}
      title={t("new.title")}
      description={t("new.description")}
      onSubmit={submit}
      cancelLabel={t("new.cancel")}
      submit={
        <Button type="submit" variant="primary" loading={pending}>
          {t("new.submit")}
        </Button>
      }
    >
      {atLimit ? (
        <GateNote>
          {t("new.atLimit", { limit: limit ?? 0 })} <UpgradeLink />
        </GateNote>
      ) : null}
      <AuthField
        id={`${id}-slug`}
        label={t("new.slug")}
        hint={t("new.slugHint")}
        error={error?.field === "slug" ? error.message : undefined}
      >
        {(control) => (
          <Input
            {...control}
            autoFocus
            required
            value={slug}
            maxLength={slugMaxLength}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={t("new.slugPlaceholder")}
            onChange={(event) => {
              setError(null);
              setSlug(normalizeSlug(event.target.value));
            }}
            leading={
              <span className="font-mono text-small whitespace-nowrap">
                {host}/b/
              </span>
            }
            className="font-mono"
          />
        )}
      </AuthField>
      <AuthField
        id={`${id}-title`}
        label={t("new.titleLabel")}
        hint={t("new.titleHint")}
      >
        {(control) => (
          <Input
            {...control}
            value={title}
            maxLength={120}
            onChange={(event) => setTitle(event.target.value)}
          />
        )}
      </AuthField>
      {error && error.field === "form" ? <ErrorText error={error} /> : null}
    </FormPage>
  );
}
