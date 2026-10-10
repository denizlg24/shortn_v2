"use client";

import { cn } from "@shortn/ui";
import { ImageIcon } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import type {
  AppearanceDraft,
  LinkItem,
  ProfileDraft,
  SocialItem,
} from "./bio-draft";
import { legacyDefaults, type AvatarShape } from "./bio-rules";
import { SocialIcon } from "./social-icons";

// The public page (legacy app/b/bio-page-display.tsx, preview=false) draws
// fixed type sizes: it never passes the stored font sizes through.
const titleStyle: CSSProperties = { fontSize: "1.25rem", fontWeight: 900 };
const descriptionStyle: CSSProperties = {
  fontSize: "0.875rem",
  fontWeight: 300,
};
const buttonText: CSSProperties = { fontSize: "0.875rem", fontWeight: 500 };

const shapeClass: Record<AvatarShape, string> = {
  circle: "rounded-full",
  rounded: "rounded-[8px]",
  square: "rounded-none",
};

const loadedFonts = new Set<string>();

// Legacy loads the family by name from Google Fonts at weight 400 and lets
// the browser synthesize the bold title; the preview does the same.
function useGoogleFont(family: string) {
  useEffect(() => {
    if (!family || loadedFonts.has(family)) return;
    loadedFonts.add(family);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${family.trim().replace(/\s+/g, "+")}:wght@400&display=swap`;
    document.head.append(link);
  }, [family]);
}

function Avatar({
  url,
  title,
  shape,
}: {
  url: string;
  title: string;
  shape: AvatarShape;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <span
      className={cn(
        "relative flex size-24 shrink-0 overflow-hidden",
        shapeClass[shape],
      )}
    >
      {failed === url ? (
        <span
          className="grid size-full place-items-center"
          style={{ background: "#f1f5f9" }}
        >
          <ImageIcon
            aria-hidden
            className="size-4"
            style={{ color: "#64748b" }}
          />
        </span>
      ) : (
        <img
          src={url}
          alt={title}
          className="size-full object-cover"
          onError={() => setFailed(url)}
        />
      )}
    </span>
  );
}

/**
 * What a visitor sees at shortn.at/b/{slug}, drawn from the unsaved drafts.
 * It follows legacy's public layout, which renders the page until P5.
 */
export function BioPreview({
  profile,
  links,
  socials,
  appearance,
}: {
  profile: ProfileDraft;
  links: LinkItem[];
  socials: SocialItem[];
  appearance: AppearanceDraft;
}) {
  const font = appearance.font.trim();
  useGoogleFont(font);
  const background = appearance.background.trim() || legacyDefaults.background;
  const color = appearance.textColor.trim() || legacyDefaults.textColor;
  const avatar = profile.avatarUrl.trim();
  const header = appearance.header;
  const align =
    header === "left-aligned"
      ? "items-start text-left"
      : header === "right-aligned"
        ? "items-end text-right"
        : "items-center text-center";
  const visibleSocials = socials.filter((social) => social.url.trim());
  const socialColor =
    appearance.socialColor === "original"
      ? undefined
      : appearance.socialColor.trim() || undefined;
  const square = appearance.buttonStyle === "square";
  const buttonStyle: CSSProperties = {
    ...buttonText,
    background: appearance.primaryColor.trim() || legacyDefaults.primaryColor,
    color: appearance.buttonTextColor.trim() || legacyDefaults.buttonTextColor,
  };
  const headerImage = appearance.headerBackgroundImage.trim();

  return (
    <div
      className="flex min-h-full w-full flex-col gap-2 pb-6"
      style={{
        background,
        color,
        fontFamily: font ? `"${font}"` : "inherit",
      }}
    >
      <div
        className="sticky top-0 z-10 flex w-full flex-col gap-2"
        style={{ background }}
      >
        {header === "none" ? (
          <header className="flex w-full flex-col items-center pt-12">
            {avatar ? (
              <Avatar
                url={avatar}
                title={profile.title}
                shape={profile.avatarShape}
              />
            ) : null}
          </header>
        ) : (
          <header
            className={cn(
              "relative flex min-h-[100px] w-full flex-col p-4",
              align,
            )}
            style={{
              height: 108,
              backgroundColor:
                appearance.headerBackgroundColor.trim() ||
                legacyDefaults.headerBackgroundColor,
              backgroundImage: headerImage
                ? `url("${headerImage}")`
                : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div
              className={cn(
                "absolute -bottom-11 flex w-full max-w-72 flex-col gap-4",
                align,
              )}
            >
              {avatar ? (
                <Avatar
                  url={avatar}
                  title={profile.title}
                  shape={profile.avatarShape}
                />
              ) : (
                <span className="size-24" />
              )}
            </div>
          </header>
        )}
        <div
          className={cn(
            "flex w-full flex-col gap-1 px-4",
            header === "none" ? "items-center text-center" : align,
            header !== "none" && avatar ? "mt-12" : "mt-6",
          )}
        >
          <p style={titleStyle} className="max-w-full break-words">
            {profile.title}
          </p>
          {profile.description.trim() ? (
            <p
              style={{ ...descriptionStyle, color }}
              className="w-full truncate opacity-75"
            >
              {profile.description}
            </p>
          ) : null}
        </div>
        {visibleSocials.length ? (
          <div className="mx-auto grid w-full max-w-72 grid-cols-[repeat(auto-fit,12.5%)] justify-center">
            {visibleSocials.map((social) => (
              <span
                key={social.id}
                className="flex aspect-square w-full items-center justify-center"
              >
                <SocialIcon platform={social.platform} color={socialColor} />
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div
        className={cn(
          "mx-auto mt-6 grid w-full max-w-2xl items-center px-4",
          square ? "grid-cols-3 gap-2" : "grid-cols-1 gap-4",
        )}
      >
        {links.map((link) => {
          const title = link.title.trim() || link.key;
          const image = link.image.trim();
          return square ? (
            <span
              key={link.linkId}
              style={buttonStyle}
              className="flex aspect-square w-full items-center justify-center overflow-hidden break-all"
            >
              {image ? (
                <img
                  src={image}
                  alt={title}
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <span className="w-full truncate px-4 text-center">
                  {title}
                </span>
              )}
            </span>
          ) : (
            <span
              key={link.linkId}
              style={buttonStyle}
              className={cn(
                "relative flex h-8 w-full items-center justify-center px-6",
                appearance.buttonStyle === "rounded"
                  ? "rounded-[4px]"
                  : "rounded-full",
              )}
            >
              {image ? (
                <img
                  src={image}
                  alt=""
                  className="absolute left-2 size-6 rounded-full object-cover"
                />
              ) : null}
              <span className="w-full truncate text-center">{title}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
