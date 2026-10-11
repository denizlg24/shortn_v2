"use client";

import type { BioEditable } from "@shortn/core";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shortn/ui";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import type { FormState } from "@/server/actions/link-pages";
import { ColorField } from "../editor/color-field";
import { ChoiceField } from "../editor/option-group";
import { useFormSubmit } from "../editor/use-form-submit";
import { FormField } from "../page/form";
import { Section } from "../page/page";
import { ImageUpload, useUploadStatus } from "../page/image-upload";
import {
  appearanceOf,
  linksOf,
  profileOf,
  socialsOf,
  type AppearanceDraft,
} from "./bio-draft";
import { BioFormFooter } from "./bio-form-footer";
import { BioPhone, BioSplit } from "./bio-phone";
import { buttonStyles, fonts, headerStyles, legacyDefaults } from "./bio-rules";

// Radix Select reserves the empty string, so "no font" needs a token.
const defaultFont = "default";

type ColorKey =
  | "background"
  | "textColor"
  | "primaryColor"
  | "buttonTextColor"
  | "headerBackgroundColor";

/** /bio/{id}/appearance: colours, buttons, type and header, with the phone beside. */
export function BioAppearanceForm({
  bio,
  action,
  cancelHref,
}: {
  bio: BioEditable;
  action: (state: FormState, form: FormData) => Promise<FormState>;
  cancelHref: string;
}) {
  const t = useTranslations("bio.appearance");
  const tBio = useTranslations("bio");
  const uploads = useUploadStatus();
  const id = useId();
  const { state, pending, onSubmit } = useFormSubmit(action);
  const [draft, setDraft] = useState(() => appearanceOf(bio));
  const [rest] = useState(() => ({
    profile: profileOf(bio),
    links: linksOf(bio),
    socials: socialsOf(bio),
  }));
  const set = (patch: Partial<AppearanceDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));
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
    <FormField id={`${id}-${key}`} label={t(`colors.${key}`)}>
      <ColorField
        id={`${id}-${key}`}
        value={draft[key]}
        placeholder={placeholder}
        pickerLabel={t(`pick.${key}`)}
        invalid={
          key === "background"
            ? state.field === "background"
            : state.field === "color"
        }
        onChange={(value) => setColor(key, value)}
      />
    </FormField>
  );

  return (
    <form onSubmit={onSubmit} noValidate>
      <BioSplit
        preview={
          <BioPhone
            drafts={{ ...rest, appearance: draft }}
            caption={tBio("preview.draft")}
          />
        }
      >
        <Section title={t("title")}>
          <input
            type="hidden"
            name="appearance"
            value={JSON.stringify(draft)}
          />
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <div className="grid gap-4 sm:grid-cols-2">
                {color("background", legacyDefaults.background)}
                {color("textColor", legacyDefaults.textColor)}
                {color("primaryColor", legacyDefaults.primaryColor)}
                {color("buttonTextColor", legacyDefaults.buttonTextColor)}
              </div>
              <p className="text-small text-fg-muted">{t("backgroundHint")}</p>
            </div>

            <ChoiceField
              label={t("buttonStyle")}
              options={buttonStyles.map((style) => ({
                value: style,
                label: t(`buttonStyles.${style}`),
              }))}
              value={draft.buttonStyle ?? "pill"}
              onValueChange={(buttonStyle) => set({ buttonStyle })}
            />

            <FormField id={`${id}-font`} label={t("font")} hint={t("fontHint")}>
              <Select
                value={draft.font || defaultFont}
                onValueChange={(font) =>
                  set({ font: font === defaultFont ? "" : font })
                }
              >
                <SelectTrigger
                  id={`${id}-font`}
                  aria-describedby={`${id}-font-hint`}
                  className="h-9"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={defaultFont}>
                    {t("fontDefault")}
                  </SelectItem>
                  {fontOptions.map((font) => (
                    <SelectItem key={font} value={font}>
                      <span style={{ fontFamily: `"${font}"` }}>{font}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

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
            />
            {draft.header === "none" ? null : (
              <div className="grid gap-4 sm:grid-cols-2">
                {color(
                  "headerBackgroundColor",
                  legacyDefaults.headerBackgroundColor,
                )}
                <FormField id={`${id}-header-image`} label={t("headerImage")}>
                  <ImageUpload
                    id={`${id}-header-image`}
                    label={t("headerImage")}
                    value={draft.headerBackgroundImage}
                    onChange={(headerBackgroundImage) =>
                      set({ headerBackgroundImage })
                    }
                    onBusyChange={uploads.onBusyChange}
                  />
                </FormField>
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
                    mode === "original"
                      ? "original"
                      : legacyDefaults.primaryColor,
                })
              }
            />
            {draft.socialColor === "original" ? null : (
              <FormField id={`${id}-social`} label={t("socialColorValue")}>
                <ColorField
                  id={`${id}-social`}
                  value={draft.socialColor}
                  placeholder={legacyDefaults.primaryColor}
                  pickerLabel={t("pick.socialColor")}
                  invalid={state.field === "color"}
                  onChange={(socialColor) => set({ socialColor })}
                  className="sm:max-w-[calc(50%-8px)]"
                />
              </FormField>
            )}
          </div>
        </Section>
        <BioFormFooter
          state={state}
          pending={pending || uploads.uploading}
          submitLabel={t("save")}
          cancelHref={cancelHref}
        />
      </BioSplit>
    </form>
  );
}
