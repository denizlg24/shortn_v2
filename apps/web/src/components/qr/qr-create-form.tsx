"use client";

import { Button, Input } from "@shortn/ui";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { createQrAction } from "@/server/actions/qr";
import { AuthField } from "../auth/auth-field";
import { ErrorText, settle, type ActionError } from "../editor/action-error";
import { FormPage } from "../editor/form-page";
import { TagsField } from "../editor/tags-field";
import { useQrError, type QrField } from "./qr-errors";

/** qr/new: the destination is all a code needs; the design comes next. */
export function QrCreateForm({
  workspace,
  tags,
}: {
  workspace: string;
  tags: string[];
}) {
  const t = useTranslations("qr");
  const router = useRouter();
  const toError = useQrError();
  const id = useId();
  const [values, setValues] = useState({
    url: "",
    title: "",
    tags: [] as string[],
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ActionError<QrField> | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    if (!values.url.trim()) {
      setError({ field: "url", message: t("errors.urlRequired") });
      return;
    }
    setPending(true);
    setError(null);
    const result = await settle(
      createQrAction(workspace, {
        url: values.url.trim(),
        ...(values.title.trim() ? { title: values.title.trim() } : {}),
        ...(values.tags.length ? { tags: values.tags } : {}),
      }),
    );
    if (!result.ok) {
      setPending(false);
      setError(toError(result));
      return;
    }
    router.push(`/${workspace}/qr/${result.data.id}/edit`);
  };

  return (
    <FormPage
      trail={[{ href: `/${workspace}/qr`, label: t("title") }]}
      title={t("createPage.title")}
      description={t("createPage.description")}
      onSubmit={submit}
      cancelLabel={t("createPage.cancel")}
      submit={
        <Button type="submit" variant="primary" loading={pending}>
          {t("createPage.submit")}
        </Button>
      }
    >
      <AuthField
        id={`${id}-url`}
        label={t("createPage.url")}
        error={error?.field === "url" ? error.message : undefined}
      >
        {(control) => (
          <Input
            {...control}
            type="url"
            inputMode="url"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            maxLength={2048}
            placeholder={t("createPage.urlPlaceholder")}
            value={values.url}
            onChange={(event) =>
              setValues({ ...values, url: event.target.value })
            }
          />
        )}
      </AuthField>
      <AuthField
        id={`${id}-title`}
        label={t("createPage.titleLabel")}
        hint={t("createPage.titleHint")}
      >
        {(control) => (
          <Input
            {...control}
            maxLength={200}
            value={values.title}
            onChange={(event) =>
              setValues({ ...values, title: event.target.value })
            }
          />
        )}
      </AuthField>
      <AuthField id={`${id}-tags`} label={t("createPage.tags")}>
        {(control) => (
          <TagsField
            control={control}
            value={values.tags}
            options={tags}
            onChange={(next) => setValues({ ...values, tags: next })}
          />
        )}
      </AuthField>
      {error && error.field !== "url" ? <ErrorText error={error} /> : null}
    </FormPage>
  );
}
