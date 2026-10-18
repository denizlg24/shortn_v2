"use client";

import type { BioEditable } from "@shortn/core";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shortn/ui";
import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { FormState } from "@/server/actions/link-pages";
import { useFormSubmit } from "../editor/use-form-submit";
import { inputClass } from "../page/form";
import { Section } from "../page/page";
import {
  appearanceOf,
  linksOf,
  profileOf,
  socialId,
  socialsOf,
  type SocialItem,
} from "./bio-draft";
import { BioFormFooter } from "./bio-form-footer";
import { BioPhone, BioSplit } from "./bio-phone";
import { maxSocials, platforms } from "./bio-rules";
import { SocialIcon } from "./social-icons";

/** /bio/{id}/socials: profile icons under the title, with the phone beside. */
export function BioSocialsForm({
  bio,
  action,
  cancelHref,
}: {
  bio: BioEditable;
  action: (state: FormState, form: FormData) => Promise<FormState>;
  cancelHref: string;
}) {
  const t = useTranslations("bio.socials");
  const tBio = useTranslations("bio");
  const { state, pending, onSubmit } = useFormSubmit(action);
  const [items, onChange] = useState(() => socialsOf(bio));
  const [rest] = useState(() => ({
    profile: profileOf(bio),
    links: linksOf(bio),
    appearance: appearanceOf(bio),
  }));
  const update = (index: number, patch: Partial<SocialItem>) =>
    onChange(
      items.map((item, at) => (at === index ? { ...item, ...patch } : item)),
    );
  const unused =
    platforms.find((platform) =>
      items.every((item) => item.platform !== platform),
    ) ?? "website";

  return (
    <form onSubmit={onSubmit} noValidate>
      <BioSplit
        preview={
          <BioPhone
            drafts={{ ...rest, socials: items }}
            caption={tBio("preview.draft")}
          />
        }
      >
        <Section title={t("title")}>
          <input type="hidden" name="socials" value={JSON.stringify(items)} />
          <div className="flex flex-col gap-4">
            {items.length === 0 ? (
              <p className="text-small text-fg-muted">{t("empty")}</p>
            ) : (
              <ul aria-label={t("listLabel")} className="flex flex-col gap-2">
                {items.map((item, index) => {
                  const known = platforms.find(
                    (platform) => platform === item.platform,
                  );
                  const name = known ? t(`platforms.${known}`) : item.platform;
                  return (
                    <li
                      key={item.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[10rem_minmax(0,1fr)_auto]"
                    >
                      <Select
                        value={item.platform}
                        onValueChange={(platform) =>
                          update(index, { platform })
                        }
                      >
                        <SelectTrigger
                          aria-label={t("platform", { position: index + 1 })}
                          className="h-9 w-full"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {known ? null : (
                            <SelectItem value={item.platform}>
                              {name}
                            </SelectItem>
                          )}
                          {platforms.map((platform) => (
                            <SelectItem key={platform} value={platform}>
                              <span className="flex items-center gap-2">
                                <SocialIcon
                                  platform={platform}
                                  className="size-4"
                                />
                                {t(`platforms.${platform}`)}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <input
                        aria-label={t("url", { platform: name })}
                        type="url"
                        inputMode="url"
                        spellCheck={false}
                        autoComplete="off"
                        maxLength={2048}
                        placeholder={t("urlPlaceholder")}
                        value={item.url}
                        aria-invalid={
                          state.field === `social-${index}` || undefined
                        }
                        onChange={(event) =>
                          update(index, { url: event.target.value })
                        }
                        className={`${inputClass} col-start-1 row-start-2 min-w-0 sm:col-start-2 sm:row-start-1`}
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="col-start-2 row-start-1 sm:col-start-3"
                        aria-label={t("remove", { platform: name })}
                        tooltip={t("remove", { platform: name })}
                        onClick={() =>
                          onChange(items.filter((_, at) => at !== index))
                        }
                      >
                        <X aria-hidden />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
            <Button
              className="self-start"
              disabled={items.length >= maxSocials}
              onClick={() =>
                onChange([
                  ...items,
                  { id: socialId(), platform: unused, url: "" },
                ])
              }
            >
              <Plus aria-hidden />
              {t("add")}
            </Button>
          </div>
        </Section>
        <BioFormFooter
          state={state}
          pending={pending}
          submitLabel={t("save")}
          cancelHref={cancelHref}
        />
      </BioSplit>
    </form>
  );
}
