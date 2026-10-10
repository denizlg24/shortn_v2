"use client";

import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shortn/ui";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { AuthField } from "../auth/auth-field";
import { ColorField } from "../editor/color-field";
import { ChoiceField } from "../editor/editor-section";
import type { AppearanceDraft } from "./bio-draft";
import { buttonStyles, fonts, headerStyles, legacyDefaults } from "./bio-rules";
import { BioSection, type SaveState } from "./bio-section";

// Radix Select reserves the empty string, so "no font" needs a token.
const defaultFont = "default";

type ColorKey =
  | "background"
  | "textColor"
  | "primaryColor"
  | "buttonTextColor"
  | "headerBackgroundColor";

export function BioAppearanceSection({
  draft,
  onChange,
  dirty,
  state,
  viewerReason,
  onSave,
}: {
  draft: AppearanceDraft;
  onChange: (draft: AppearanceDraft) => void;
  dirty: boolean;
  state: SaveState;
  viewerReason: string | null;
  onSave: () => void;
}) {
  const t = useTranslations("bio.appearance");
  const id = useId();
  const locked = viewerReason !== null;
  const set = (patch: Partial<AppearanceDraft>) =>
    onChange({ ...draft, ...patch });
  const setColor = (key: ColorKey, value: string) => {
    const patch: Partial<AppearanceDraft> = {};
    patch[key] = value;
    set(patch);
  };
  const fontOptions =
    fonts.some((font) => font === draft.font) || !draft.font
      ? fonts
      : [draft.font, ...fonts];

  const color = (key: ColorKey, placeholder: string) => (
    <AuthField id={`${id}-${key}`} label={t(`colors.${key}`)}>
      {(control) => (
        <ColorField
          control={control}
          value={draft[key]}
          placeholder={placeholder}
          pickerLabel={t(`pick.${key}`)}
          disabled={locked}
          onChange={(value) => setColor(key, value)}
        />
      )}
    </AuthField>
  );

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
      <div className="grid gap-4 sm:grid-cols-2">
        {color("background", legacyDefaults.background)}
        {color("textColor", legacyDefaults.textColor)}
        {color("primaryColor", legacyDefaults.primaryColor)}
        {color("buttonTextColor", legacyDefaults.buttonTextColor)}
      </div>
      <p className="-mt-2 text-meta text-fg-muted">{t("backgroundHint")}</p>

      <ChoiceField
        label={t("buttonStyle")}
        options={buttonStyles.map((style) => ({
          value: style,
          label: t(`buttonStyles.${style}`),
        }))}
        value={draft.buttonStyle ?? "pill"}
        onValueChange={(buttonStyle) => set({ buttonStyle })}
        disabled={locked}
      />

      <AuthField id={`${id}-font`} label={t("font")} hint={t("fontHint")}>
        {(control) => (
          <Select
            value={draft.font || defaultFont}
            onValueChange={(font) =>
              set({ font: font === defaultFont ? "" : font })
            }
            disabled={locked}
          >
            <SelectTrigger
              id={control.id}
              aria-describedby={control["aria-describedby"]}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value={defaultFont}>{t("fontDefault")}</SelectItem>
              {fontOptions.map((font) => (
                <SelectItem key={font} value={font}>
                  <span style={{ fontFamily: `"${font}"` }}>{font}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </AuthField>

      <ChoiceField
        label={t("header")}
        hint={t("headerHint")}
        options={[
          { value: "none", label: t("headerStyles.none") },
          ...headerStyles.map((style) => ({
            value: style,
            label: t(`headerStyles.${style}`),
          })),
        ]}
        value={draft.header}
        onValueChange={(header) => set({ header })}
        disabled={locked}
      />
      {draft.header === "none" ? null : (
        <div className="grid gap-4 sm:grid-cols-2">
          {color("headerBackgroundColor", legacyDefaults.headerBackgroundColor)}
          <AuthField id={`${id}-header-image`} label={t("headerImage")}>
            {(control) => (
              <Input
                {...control}
                type="url"
                inputMode="url"
                spellCheck={false}
                autoComplete="off"
                maxLength={2048}
                placeholder="https://"
                value={draft.headerBackgroundImage}
                aria-invalid={
                  state.error?.field === "headerImage"
                    ? true
                    : control["aria-invalid"]
                }
                onChange={(event) =>
                  set({ headerBackgroundImage: event.target.value })
                }
              />
            )}
          </AuthField>
        </div>
      )}

      <ChoiceField
        label={t("socialColor")}
        options={[
          { value: "original", label: t("socialColors.original") },
          { value: "custom", label: t("socialColors.custom") },
        ]}
        value={draft.socialColor === "original" ? "original" : "custom"}
        onValueChange={(mode) =>
          set({
            socialColor:
              mode === "original" ? "original" : legacyDefaults.primaryColor,
          })
        }
        disabled={locked}
      />
      {draft.socialColor === "original" ? null : (
        <AuthField id={`${id}-social`} label={t("socialColorValue")}>
          {(control) => (
            <ColorField
              control={control}
              value={draft.socialColor}
              placeholder={legacyDefaults.primaryColor}
              pickerLabel={t("pick.socialColor")}
              disabled={locked}
              onChange={(socialColor) => set({ socialColor })}
              className="sm:max-w-[calc(50%-8px)]"
            />
          )}
        </AuthField>
      )}
    </BioSection>
  );
}
