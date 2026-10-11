"use client";

import type { BioEditable } from "@shortn/core";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import type { FormState } from "@/server/actions/link-pages";
import { ChoiceField } from "../editor/option-group";
import { useFormSubmit } from "../editor/use-form-submit";
import { FormField, inputClass } from "../page/form";
import { Section } from "../page/page";
import { ImageUpload, useUploadStatus } from "../page/image-upload";
import { appearanceOf, linksOf, profileOf, socialsOf } from "./bio-draft";
import { BioFormFooter } from "./bio-form-footer";
import { BioPhone, BioSplit } from "./bio-phone";
import { avatarShapes } from "./bio-rules";

/** /bio/{id}/profile: title, description and avatar, with the phone beside. */
export function BioProfileForm({
  bio,
  action,
  cancelHref,
}: {
  bio: BioEditable;
  action: (state: FormState, form: FormData) => Promise<FormState>;
  cancelHref: string;
}) {
  const t = useTranslations("bio");
  const { state, pending, onSubmit } = useFormSubmit(action);
  const [draft, setDraft] = useState(() => profileOf(bio));
  const [rest] = useState(() => ({
    links: linksOf(bio),
    socials: socialsOf(bio),
    appearance: appearanceOf(bio),
  }));
  const uploads = useUploadStatus();
  const id = useId();
  const invalid = (field: string) => (state.field === field ? true : undefined);

  return (
    <form onSubmit={onSubmit} noValidate>
      <BioSplit
        preview={
          <BioPhone
            drafts={{ profile: draft, ...rest }}
            caption={t("preview.draft")}
          />
        }
      >
        <Section title={t("profile.title")}>
          <div className="flex flex-col gap-5">
            <FormField id={`${id}-title`} label={t("profile.name")}>
              <input
                id={`${id}-title`}
                name="title"
                required
                maxLength={120}
                value={draft.title}
                onChange={(event) =>
                  setDraft({ ...draft, title: event.target.value })
                }
                aria-invalid={invalid("title")}
                className={inputClass}
              />
            </FormField>
            <FormField
              id={`${id}-description`}
              label={t("profile.bio")}
              hint={t("profile.bioHint")}
              optional={t("form.optional")}
            >
              <textarea
                id={`${id}-description`}
                name="description"
                rows={3}
                maxLength={500}
                value={draft.description}
                onChange={(event) =>
                  setDraft({ ...draft, description: event.target.value })
                }
                aria-describedby={`${id}-description-hint`}
                className={`${inputClass} h-auto py-2`}
              />
            </FormField>
            <FormField
              id={`${id}-avatar`}
              label={t("profile.avatar")}
              hint={t("profile.avatarHint")}
              optional={t("form.optional")}
            >
              <ImageUpload
                id={`${id}-avatar`}
                label={t("profile.avatar")}
                name="avatarUrl"
                value={draft.avatarUrl}
                onChange={(avatarUrl) => setDraft({ ...draft, avatarUrl })}
                onBusyChange={uploads.onBusyChange}
              />
            </FormField>
            <input type="hidden" name="avatarShape" value={draft.avatarShape} />
            <ChoiceField
              label={t("profile.shape")}
              options={avatarShapes.map((shape) => ({
                value: shape,
                label: t(`profile.shapes.${shape}`),
              }))}
              value={draft.avatarShape}
              onValueChange={(avatarShape) =>
                setDraft({ ...draft, avatarShape })
              }
            />
          </div>
        </Section>
        <BioFormFooter
          state={state}
          pending={pending || uploads.uploading}
          submitLabel={t("profile.save")}
          cancelHref={cancelHref}
        />
      </BioSplit>
    </form>
  );
}
