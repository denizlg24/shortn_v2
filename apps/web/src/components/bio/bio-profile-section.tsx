"use client";

import { Input, Textarea } from "@shortn/ui";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { AuthField } from "../auth/auth-field";
import { ChoiceField } from "../editor/editor-section";
import type { ProfileDraft } from "./bio-draft";
import { avatarShapes } from "./bio-rules";
import { BioSection, type SaveState } from "./bio-section";

export function BioProfileSection({
  draft,
  onChange,
  dirty,
  state,
  viewerReason,
  onSave,
}: {
  draft: ProfileDraft;
  onChange: (draft: ProfileDraft) => void;
  dirty: boolean;
  state: SaveState;
  viewerReason: string | null;
  onSave: () => void;
}) {
  const t = useTranslations("bio.profile");
  const id = useId();
  return (
    <BioSection
      title={t("title")}
      description={t("description")}
      dirty={dirty}
      state={state}
      saveLabel={t("save")}
      viewerReason={viewerReason}
      onSave={onSave}
    >
      <AuthField id={`${id}-title`} label={t("name")}>
        {(control) => (
          <Input
            {...control}
            maxLength={120}
            value={draft.title}
            onChange={(event) =>
              onChange({ ...draft, title: event.target.value })
            }
          />
        )}
      </AuthField>
      <AuthField id={`${id}-description`} label={t("bio")} hint={t("bioHint")}>
        {(control) => (
          <Textarea
            {...control}
            rows={3}
            maxLength={500}
            value={draft.description}
            onChange={(event) =>
              onChange({ ...draft, description: event.target.value })
            }
          />
        )}
      </AuthField>
      <AuthField id={`${id}-avatar`} label={t("avatar")} hint={t("avatarHint")}>
        {(control) => (
          <Input
            {...control}
            type="url"
            inputMode="url"
            spellCheck={false}
            autoComplete="off"
            maxLength={2048}
            placeholder="https://"
            value={draft.avatarUrl}
            onChange={(event) =>
              onChange({ ...draft, avatarUrl: event.target.value })
            }
          />
        )}
      </AuthField>
      <ChoiceField
        label={t("shape")}
        options={avatarShapes.map((shape) => ({
          value: shape,
          label: t(`shapes.${shape}`),
        }))}
        value={draft.avatarShape}
        onValueChange={(avatarShape) => onChange({ ...draft, avatarShape })}
        disabled={viewerReason !== null}
      />
    </BioSection>
  );
}
