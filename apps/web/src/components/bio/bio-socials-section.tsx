"use client";

import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shortn/ui";
import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { socialId, type SocialItem } from "./bio-draft";
import { maxSocials, platforms } from "./bio-rules";
import { BioSection, type SaveState } from "./bio-section";
import { SocialIcon } from "./social-icons";

export function BioSocialsSection({
  items,
  onChange,
  dirty,
  state,
  viewerReason,
  onSave,
}: {
  items: SocialItem[];
  onChange: (items: SocialItem[]) => void;
  dirty: boolean;
  state: SaveState;
  viewerReason: string | null;
  onSave: () => void;
}) {
  const t = useTranslations("bio.socials");
  const locked = viewerReason !== null;
  const update = (index: number, patch: Partial<SocialItem>) =>
    onChange(
      items.map((item, at) => (at === index ? { ...item, ...patch } : item)),
    );
  const unused =
    platforms.find((platform) =>
      items.every((item) => item.platform !== platform),
    ) ?? "website";

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
              <li key={item.id} className="flex items-center gap-2">
                <Select
                  value={item.platform}
                  onValueChange={(platform) => update(index, { platform })}
                  disabled={locked}
                >
                  <SelectTrigger
                    aria-label={t("platform", { position: index + 1 })}
                    className="w-40 shrink-0"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {known ? null : (
                      <SelectItem value={item.platform}>{name}</SelectItem>
                    )}
                    {platforms.map((platform) => (
                      <SelectItem key={platform} value={platform}>
                        <span className="flex items-center gap-2">
                          <SocialIcon platform={platform} className="size-4" />
                          {t(`platforms.${platform}`)}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  aria-label={t("url", { platform: name })}
                  type="url"
                  inputMode="url"
                  spellCheck={false}
                  autoComplete="off"
                  maxLength={2048}
                  placeholder={t("urlPlaceholder")}
                  value={item.url}
                  aria-invalid={
                    state.error?.field === `social-${index}` || undefined
                  }
                  onChange={(event) =>
                    update(index, { url: event.target.value })
                  }
                  frameClassName="min-w-0 flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
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
        disabled={locked || items.length >= maxSocials}
        onClick={() =>
          onChange([...items, { id: socialId(), platform: unused, url: "" }])
        }
      >
        <Plus aria-hidden />
        {t("add")}
      </Button>
    </BioSection>
  );
}
